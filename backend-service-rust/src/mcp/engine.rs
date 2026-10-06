use crate::{errors::AppError, state::AppState};
use rquickjs::{
    loader::{BuiltinLoader, BuiltinResolver},
    Context, Module, Runtime,
};
use serde_json::Value;
use std::{
    sync::Arc,
    time::{Duration, Instant},
};

const MODULES: &[(&str, &str)] = &[
    (
        "index.js",
        include_str!("../../../calculation-engine/index.js"),
    ),
    (
        "calculationDocument.js",
        include_str!("../../../calculation-engine/calculationDocument.js"),
    ),
    (
        "processingPipeline.js",
        include_str!("../../../calculation-engine/processingPipeline.js"),
    ),
    (
        "processor_evaluator.js",
        include_str!("../../../calculation-engine/processor_evaluator.js"),
    ),
    (
        "processorContext.js",
        include_str!("../../../calculation-engine/processorContext.js"),
    ),
    (
        "calculationOutputs.js",
        include_str!("../../../calculation-engine/calculationOutputs.js"),
    ),
    (
        "collapseTables.js",
        include_str!("../../../calculation-engine/collapseTables.js"),
    ),
    (
        "workCategories.js",
        include_str!("../../../calculation-engine/workCategories.js"),
    ),
    (
        "normRates.js",
        include_str!("../../../calculation-engine/normRates.js"),
    ),
];
// Create and destroy the runtime on the blocking worker. No OS or network APIs
// are registered; only embedded modules and JSON inputs enter the interpreter.
pub fn execute(input: Value) -> Result<Value, AppError> {
    let run = || -> rquickjs::Result<String> {
        let runtime = Runtime::new()?;
        runtime.set_memory_limit(64 * 1024 * 1024);
        runtime.set_max_stack_size(512 * 1024);
        let deadline = Instant::now() + Duration::from_secs(5);
        runtime.set_interrupt_handler(Some(Box::new(move || Instant::now() > deadline)));
        let mut resolver = BuiltinResolver::default();
        let mut loader = BuiltinLoader::default();
        for (name, source) in MODULES {
            resolver = resolver.with_module(*name);
            loader = loader.with_module(*name, *source);
        }
        runtime.set_loader(resolver, loader);
        let context = Context::full(&runtime)?;
        context.with(|ctx| {
            let input = serde_json::to_string(&input).unwrap();
            ctx.globals().set("__input", input)?;
            ctx.globals().set("__uuid", rquickjs::Function::new(ctx.clone(), || uuid::Uuid::new_v4().to_string())?)?;
            ctx.eval::<(), _>("globalThis.structuredClone = v => JSON.parse(JSON.stringify(v)); globalThis.crypto = {randomUUID: __uuid}; globalThis.console = {log(){},error(){},warn(){}};")?;
            let module = Module::declare(ctx.clone(), "entry.js", "import {execute} from 'index.js'; globalThis.__output = JSON.stringify(execute(JSON.parse(__input)));" )?;
            let (_, promise) = module.eval()?; promise.finish::<()>()?;
            ctx.globals().get("__output")
        })
    };
    let output = run().map_err(|e| {
        AppError::InvalidData(format!(
            "Calculation execution failed / Помилка обчислення: {e}"
        ))
    })?;
    Ok(serde_json::from_str(&output)?)
}
pub async fn evaluate(state: &Arc<AppState>, input: Value) -> Result<Value, AppError> {
    let permit = state
        .mcp
        .evaluations
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| AppError::InternalServerError("Engine unavailable".into()))?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        execute(input)
    })
    .await
    .map_err(|e| AppError::InternalServerError(e.to_string()))?
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn resolves_decimal_totals_without_host_access() {
        let result = execute(json!({"document": {"car":{},"calculations": {"Капот":[{"name":"Paint","result":[{"name":"Labour","estimation":1.25,"price":100.01}]}]}}})).unwrap();
        assert_eq!(result["document"]["grandTotal"], json!(125.01));
    }
    #[test]
    fn interrupts_infinite_processors() {
        let result = execute(
            json!({"process":true,"document":{"processorSnapshot":"while(true){}","parts":{"selectedParts":[]}}}),
        );
        assert!(result.is_err());
    }
}
