use super::{auth::Identity, calculations};
use crate::{errors::AppError, state::AppState};
use rmcp::{
    model::{
        CallToolRequestParams, CallToolResponse, CallToolResult, Implementation, ListToolsResult,
        PaginatedRequestParams, ServerCapabilities, ServerInfo, Tool,
    },
    service::RequestContext,
    ErrorData, RoleServer, ServerHandler,
};
use serde_json::{json, Value};
use std::sync::Arc;
pub struct AutolabMcp {
    pub state: Arc<AppState>,
}
fn string(en: &str, uk: &str) -> Value {
    json!({"type":"string","description":format!("EN: {en}\nUK: {uk}")})
}
fn number(en: &str, uk: &str) -> Value {
    json!({"type":"number","minimum":0,"description":format!("EN: {en}\nUK: {uk}")})
}
fn object(properties: Value, required: Value) -> Value {
    json!({"type":"object","properties":properties,"required":required,"additionalProperties":false})
}
fn changes() -> Value {
    let car = object(
        json!({"make":string("Brand/make, any custom text; no catalog verification","Марка, довільний текст; без перевірки каталогу"),"model":string("Model, any custom text; no catalog verification","Модель, довільний текст; без перевірки каталогу"),"year":string("Year as free-form text; no format verification","Рік довільним текстом; без перевірки формату"),"carClass":string("Catalog class","Клас з каталогу"),"bodyType":string("Catalog body type","Тип кузова з каталогу"),"licensePlate":string("Registration plate, any text; no verification","Державний номер, довільний текст; без перевірки"),"vin":string("VIN, any text; no length, checksum or registry verification","VIN, довільний текст; без перевірки довжини, контрольної суми чи реєстру"),"notes":string("Vehicle notes","Примітки до автомобіля")}),
        json!([]),
    );
    let mut action = string(
        "Exact repair action from repair_actions; omit while asking for clarification",
        "Точна операція з repair_actions; пропустіть, якщо потрібне уточнення",
    );
    action["type"] = json!(["string", "null"]);
    let part = object(
        json!({"name":string("Exact catalog part name","Точна назва деталі з каталогу"),"selectedAction":action,"damageLevel":{"type":"integer","minimum":0,"enum":[0,2,5,7,10],"description":"EN: Damage severity: 0 none, 2 light, 5 medium, 7 severe, 10 critical. UK: Ступінь пошкодження: 0 немає, 2 легке, 5 середнє, 7 сильне, 10 критичне."},"damageLevelMode":{"type":"string","enum":["simple","grid"],"description":"EN: Quick severity or damage grid. UK: Швидкий ступінь або карта пошкоджень."},"grid":{"type":"array","items":{"type":"array","items":{"type":"integer","minimum":-1,"maximum":10}},"description":"EN: Damage-grid cell values. UK: Значення комірок карти пошкоджень."}}),
        json!(["name"]),
    );
    let edit = object(
        json!({"entity_id":string("Returned stable row, table, part-total, category-total, or grand-total ID","Повернений сталий ID рядка, таблиці, підсумку деталі, категорії або grand-total"),"field":{"type":"string","enum":["name","estimation","unit","price","sum","category","orderingNum","tooltip","excluded","total"],"description":"EN: Editable cell field. UK: Поле комірки для редагування."},"value":{"type":["string","number","boolean","null"],"description":"EN: Literal value; blank and zero are explicit values. UK: Значення; порожнє значення та нуль є явними змінами."},"reset":{"type":"boolean","description":"EN: Remove this override and restore the default. UK: Скинути зміну та відновити типове значення."}}),
        json!(["entity_id", "field"]),
    );
    object(
        json!({"car":car,"paint":object(json!({"color":string("Catalog color","Колір з каталогу"),"paintType":string("Catalog paint type","Тип фарби з каталогу")}),json!([])),"order":object(json!({"orderNumber":string("Order number; omitted or blank defaults to 001","Номер замовлення; відсутній чи порожній — 001"),"orderNotes":string("Document notes","Примітки до документа"),"orderDate":string("ISO order date","Дата замовлення у форматі ISO")}),json!([])),"repairQuality":string("Catalog repair quality","Якість ремонту з каталогу"),"parts":{"type":"array","items":part,"description":"EN: Complete active part list; omission preserves it, [] removes all parts. UK: Повний список активних деталей; відсутність зберігає список, [] видаляє всі деталі."},"edits":{"type":"array","items":edit,"description":"EN: Edits by stable IDs. UK: Зміни за сталими ID."},"restore_rows":{"type":"array","items":object(json!({"part":string("Catalog part name","Назва деталі з каталогу"),"row_id":string("Archived row ID","ID архівованого рядка")}),json!(["part","row_id"]))},"inputOverrides":{"type":"object","description":"EN: Calculation-only lookup overrides: {part:{table:{column:value}}}. UK: Зміни довідникових значень лише цього розрахунку: {деталь:{таблиця:{колонка:значення}}}."},"refresh_sources":{"type":"boolean","description":"EN: Explicitly adopt current catalog/processors; retain compatible edits. UK: Явно оновити дані та процесори з каталогу, зберегти сумісні зміни."}}),
        json!([]),
    )
}
fn definitions() -> Vec<Tool> {
    let language = json!({"type":"string","enum":["en","uk","ua"],"description":"EN: Response language; default company preference. UK: Мова відповіді; типово мова компанії."});
    let id = string(
        "Calculation ID returned by create_calculation",
        "ID розрахунку від create_calculation",
    );
    let revision = json!({"type":"integer","minimum":0,"description":"EN: Latest returned revision, prevents stale writes. UK: Остання повернена версія, запобігає перезапису новіших змін."});
    let pagination = json!({"type":"integer","minimum":0,"description":"EN: Page offset. UK: Зміщення сторінки."});
    let limit = json!({"type":"integer","minimum":1,"maximum":100,"description":"EN: Page size, default 50. UK: Розмір сторінки, типово 50."});
    let rates = object(
        json!({"id":string("Stable ID, unique and not base","Сталий унікальний ID, не base"),"name":string("Rate name","Назва ставки"),"amount":number("Amount per norm-hour, same currency as base","Сума за нормо-годину у валюті основної ставки")}),
        json!(["id", "name", "amount"]),
    );
    let definitions=vec![
        ("search_catalog","Search calculation identifiers and all available PDF templates, including user templates. Vehicle brand/model searches are optional; accept custom vehicle identity without verification. Never guess ambiguous calculation identifiers.","Знайдіть розрахункові ідентифікатори та всі доступні шаблони PDF, зокрема власні. Пошук марки/моделі необов’язковий; приймайте довільні дані автомобіля без перевірки. Не вгадуйте неоднозначні розрахункові ідентифікатори.",object(json!({"kind":{"type":"string","enum":["vehicles","class_body_types","parts","subparts","repair_actions","colors","paint_types","repair_quality","templates"],"description":"EN: Catalog to search. UK: Каталог для пошуку."},"query":string("English or Ukrainian search text","Текст пошуку англійською або українською"),"make":string("Make to list its models","Марка для переліку моделей"),"car_class":string("Class when searching parts","Клас для пошуку деталей"),"body_type":string("Body type for parts/subparts","Кузов для деталей та піддеталей"),"part":string("Part to filter repair actions","Деталь для фільтрації ремонтних операцій"),"offset":pagination,"limit":limit,"language":language}),json!(["kind"])),true),
        ("create_calculation","Start an interactive estimate, optionally with incomplete inputs or an existing saved file. Ask for missing inputs and show intermediate results.","Почніть інтерактивний кошторис із неповними даними або збереженим файлом. Запитайте відсутні дані та покажіть проміжні результати.",object(json!({"inputs":changes(),"saved_filename":string("Existing calculation filename to copy","Назва існуючого файлу для копіювання"),"language":language}),json!([])),false),
        ("get_calculation","Resume a saved estimate and inspect totals, missing inputs and editable IDs.","Відновіть збережений кошторис, перегляньте підсумки, відсутні дані та ID для редагування.",object(json!({"calculation_id":id,"offset":pagination,"limit":limit,"include_sources":{"type":"boolean","description":"EN: Include saved lookup tables and overrides for inspection/editing. UK: Додати збережені довідникові таблиці та зміни для перегляду/редагування."},"language":language}),json!(["calculation_id"])),true),
        ("update_calculation","Change inputs or cells, reset edits, restore archived rows or refresh sources. Show new results before the next step.","Змініть дані чи комірки, скиньте зміни, відновіть архівовані рядки чи оновіть джерела. Покажіть нові результати перед наступним кроком.",object(json!({"calculation_id":id,"expected_revision":revision,"changes":changes(),"language":language}),json!(["calculation_id","expected_revision","changes"])),false),
        ("finalize_calculation","Generate a saved PDF of a reviewed estimate. Returns an unauthenticated public link valid for 30 days. Anyone with the link can download it. Use public_page_url for a browser download page, public_url for direct PDF bytes. To choose any available template, search_catalog(kind=templates), then pass its exact filename in template_name.","Створіть збережений PDF перевіреного кошторису. Повертає публічне посилання без авторизації на 30 днів. Кожен, хто має посилання, може завантажити PDF. Покажіть public_page_url для сторінки завантаження, public_url — прямий файл PDF. Для вибору будь-якого шаблону викличте search_catalog(kind=templates) і передайте точну назву у template_name.",object(json!({"calculation_id":id,"expected_revision":revision,"template_name":string("Any filename returned by search_catalog(kind=templates), including user templates; default calculation_ua.html","Будь-який файл із search_catalog(kind=templates), зокрема власний шаблон; типово calculation_ua.html"),"language":language}),json!(["calculation_id","expected_revision"])),false),
        ("get_company_info","Read company details, currency, base hourly rate and named rates. Norm-hour is a standard labor hour.","Перевірте дані компанії, валюту, основну погодинну ставку та іменовані ставки. Нормо-година — нормативна година праці.",object(json!({"language":language}),json!([])),true),
        ("set_hour_rates","Set base/named rates or assign them to parts/tables. Default scope is the current calculation. Change company defaults only when explicitly requested. Example: 'use 800 per hour' changes this estimate.","Установіть основну/іменовані ставки або призначте їх деталям/таблицям. Типова область — поточний розрахунок. Змінюйте ставки компанії лише за явним запитом. Приклад: «використай 800 за нормо-годину» змінює цей кошторис.",object(json!({"scope":{"type":"string","enum":["calculation","company"],"default":"calculation","description":"EN: Change this estimate or company defaults explicitly. UK: Змінити кошторис або явно типові ставки компанії."},"calculation_id":id,"expected_revision":revision,"base_amount":number("Base labor price per hour; zero is valid","Основна вартість нормо-години; нуль допустимий"),"additional_rates":{"type":"array","items":rates,"description":"EN: Complete named-rate list; omission preserves it. UK: Повний перелік іменованих ставок; відсутність зберігає його."},"assignments":{"type":"array","items":object(json!({"part":string("Part name","Назва деталі"),"table_id":string("Stable returned table ID; omit both table fields for part-level rate","Повернений сталий ID таблиці; пропустіть обидва поля таблиці для ставки деталі"),"table_name":string("Exact unique table name, as an alternative to table_id","Точна унікальна назва таблиці як альтернатива table_id"),"rate_id":string("Named rate ID or base","ID іменованої ставки або base")}),json!(["part","rate_id"]))},"language":language}),json!([])),false),
    ];
    definitions.into_iter().map(|(name,en,uk,schema,readonly)|serde_json::from_value(json!({"name":name,"description":format!("EN: {en}\nUK: {uk}"),"inputSchema":schema,"annotations":{"readOnlyHint":readonly,"destructiveHint":!readonly,"idempotentHint":readonly||name=="finalize_calculation","openWorldHint":name=="finalize_calculation"}})).unwrap()).collect()
}
pub(super) fn scope(name: &str, args: &Value) -> &'static str {
    match name {
        "search_catalog" | "get_calculation" => "calculations:read",
        "get_company_info" => "company:read",
        "set_hour_rates" if args["scope"] == "company" => "company:write",
        "finalize_calculation" => "pdfs:publish",
        _ => "calculations:write",
    }
}
// Validate the deliberately small JSON-schema vocabulary used above. The SDK
// transports schemas but does not validate tool arguments for hand-written handlers.
fn validate(schema: &Value, value: &Value, path: &str) -> Result<(), AppError> {
    let matches = |kind: &str| match kind {
        "object" => value.is_object(),
        "array" => value.is_array(),
        "string" => value.is_string(),
        "number" => value.is_number(),
        "integer" => value.as_u64().is_some() || value.as_i64().is_some(),
        "boolean" => value.is_boolean(),
        "null" => value.is_null(),
        _ => false,
    };
    let valid = match &schema["type"] {
        Value::String(kind) => matches(kind),
        Value::Array(kinds) => kinds.iter().any(|k| k.as_str().is_some_and(matches)),
        _ => true,
    };
    if !valid
        || schema["enum"]
            .as_array()
            .is_some_and(|choices| !choices.contains(value))
    {
        return Err(AppError::InvalidData(format!(
            "Invalid value at {path} / Неприпустиме значення: {path}"
        )));
    }
    if let Some(number) = value.as_f64() {
        if schema["minimum"].as_f64().is_some_and(|min| number < min)
            || schema["maximum"].as_f64().is_some_and(|max| number > max)
        {
            return Err(AppError::InvalidData(format!(
                "Out of range: {path} / Значення поза діапазоном: {path}"
            )));
        }
    }
    if let Some(object) = value.as_object() {
        for name in schema["required"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
        {
            if !object.contains_key(name) {
                return Err(AppError::InvalidData(format!(
                    "Missing {path}.{name} / Відсутнє поле {path}.{name}"
                )));
            }
        }
        for (name, entry) in object {
            if let Some(child) = schema["properties"].get(name) {
                validate(child, entry, &format!("{path}.{name}"))?;
            } else if schema["additionalProperties"] == false {
                return Err(AppError::InvalidData(format!(
                    "Unknown argument {path}.{name} / Невідомий аргумент {path}.{name}"
                )));
            }
            if name == "__proto__" || name == "constructor" || name == "prototype" {
                return Err(AppError::InvalidData("Reserved property name".into()));
            }
        }
    }
    if let Some(array) = value.as_array() {
        for (i, entry) in array.iter().enumerate() {
            if !schema["items"].is_null() {
                validate(&schema["items"], entry, &format!("{path}[{i}]"))?;
            }
        }
    }
    Ok(())
}
impl ServerHandler for AutolabMcp {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build()).with_server_info(Implementation::new("Autolab MCP", env!("CARGO_PKG_VERSION"))).with_instructions("EN: Autolab estimates automotive repair costs. Accept custom brand/make, model, year, VIN, plate and notes verbatim without verification; vehicle catalog searches are optional. Search catalogs for calculation classifications/parts/actions and available templates, start a draft, ask for missing inputs, show intermediate estimates, update by revision, then finalize a reviewed PDF. Use current-estimate rates unless explicitly asked to change company defaults. UK: Autolab розраховує вартість ремонту автомобілів. Приймайте довільні марку, модель, рік, VIN, номер та примітки без перевірки й без зміни тексту; пошук автомобіля в каталозі необов’язковий. Шукайте в каталогах класи/кузови, деталі, операції та доступні шаблони, створіть чернетку, запитайте відсутні дані, покажіть проміжний кошторис, оновлюйте за версією та створіть PDF. Ставки змінюйте в поточному кошторисі, якщо явно не запитано зміну ставок компанії.")
    }
    async fn list_tools(
        &self,
        _: Option<PaginatedRequestParams>,
        _: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        Ok(ListToolsResult {
            tools: definitions(),
            ..Default::default()
        })
    }
    fn get_tool(&self, name: &str) -> Option<Tool> {
        definitions().into_iter().find(|t| t.name == name)
    }
    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, ErrorData> {
        let args = Value::Object(request.arguments.unwrap_or_default());
        let name = request.name.as_ref();
        let identity = context
            .extensions
            .get::<axum::http::request::Parts>()
            .and_then(|parts| parts.extensions.get::<Identity>())
            .cloned();
        let result = async {
            let identity = identity.ok_or(AppError::Unauthorized)?;
            if !identity.scopes.iter().any(|s| s == scope(name, &args)) {
                return Err(AppError::Forbidden);
            }
            super::licensed(&self.state, &identity.email).await?;
            let definition = self
                .get_tool(name)
                .ok_or_else(|| AppError::BadRequest("Unknown tool".into()))?;
            validate(
                &Value::Object((*definition.input_schema).clone()),
                &args,
                "arguments",
            )?;
            let email = &identity.email;
            match name {
                "search_catalog" => calculations::search(&self.state, email, &args).await,
                "create_calculation" => calculations::create(&self.state, email, &args).await,
                "get_calculation" => calculations::inspect(&self.state, email, &args).await,
                "update_calculation" => calculations::update(&self.state, email, &args).await,
                "finalize_calculation" => calculations::finalize(&self.state, email, &args).await,
                "get_company_info" => {
                    let account_lock = self.state.mcp.account_lock(email).await;
                    let _lock = account_lock.lock().await;
                    Ok(json!(
                        crate::api::v1::user::find_or_create_company_info(&self.state, email)
                            .await?
                    ))
                }
                "set_hour_rates" => calculations::rates(&self.state, email, &args).await,
                _ => Err(AppError::BadRequest(
                    "Unknown tool / Невідомий інструмент".into(),
                )),
            }
        }
        .await;
        match result {
            Ok(value) => Ok(CallToolResult::structured(value).into()),
            Err(error) => {
                let message=match error {AppError::NotFound|AppError::FileNotFound=>"Not found in your account / Не знайдено у вашому обліковому записі".into(),AppError::InternalServerError(_)|AppError::IoError(_)|AppError::DbError(_)=>"Operation failed; retry or contact support / Операція не виконана; повторіть або зверніться до підтримки".into(),_=>error.to_string()};
                Ok(CallToolResult::structured_error(
                    json!({"error":message,"required_scope":scope(name,&args)}),
                )
                .into())
            }
        }
    }
}
#[cfg(test)]
mod tests {
    #[test]
    fn all_tools_are_bilingual() {
        let tools = super::definitions();
        assert_eq!(tools.len(), 7);
        for tool in tools {
            let description = tool.description.unwrap();
            assert!(description.contains("EN:"));
            assert!(description.contains("UK:"));
        }
    }
}
