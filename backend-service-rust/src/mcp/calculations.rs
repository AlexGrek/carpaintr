use super::{engine, get, put};
use crate::{
    api::v1::{
        calc::{
            output_endpoints::GeneratePdfRequest, persistence_endpoints::CALCULATIONS,
            plugin_endpoints::bundle_plugins_as_array,
        },
        user::{find_or_create_company_info, save_company_info, validate_pricing},
    },
    errors::AppError,
    models::{NormRate, PricingPreferences},
    state::AppState,
    utils,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    path::{Component, Path, PathBuf},
    sync::Arc,
};
#[derive(Serialize, Deserialize)]
struct Draft {
    owner_id: String,
    filename: String,
}
fn bad(s: &str) -> AppError {
    AppError::InvalidData(s.into())
}
fn required<'a>(value: &'a Value, key: &str) -> Result<&'a str, AppError> {
    value[key]
        .as_str()
        .ok_or_else(|| bad(&format!("Missing {key} / Відсутнє поле {key}")))
}
fn relative(path: &str) -> Result<PathBuf, AppError> {
    let p = PathBuf::from(path);
    if p.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err(AppError::Forbidden);
    }
    Ok(p)
}
async fn catalog_bytes(
    state: &Arc<AppState>,
    email: &str,
    path: &str,
) -> Result<Vec<u8>, AppError> {
    let rel = relative(path)?;
    let path = utils::get_file_path_user_common(&state.data_dir_path, email, &rel).await?;
    let content =
        utils::get_file_as_string_by_path(&path, &state.data_dir_path, &state.cache).await?;
    Ok(content.as_bytes().to_vec())
}
async fn yaml(state: &Arc<AppState>, email: &str, path: &str) -> Result<Value, AppError> {
    Ok(serde_yaml::from_slice(
        &catalog_bytes(state, email, path).await?,
    )?)
}
async fn csv(state: &Arc<AppState>, email: &str, path: &str) -> Result<Value, AppError> {
    let path =
        utils::get_file_path_user_common(&state.data_dir_path, email, &relative(path)?).await?;
    Ok(serde_json::to_value(
        &*utils::parse_csv_file_async_safe(&state.data_dir_path, &path, &state.cache).await?,
    )?)
}
fn english_label(value: &str) -> String {
    match value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .as_str()
    {
        "Капот" => "Hood / bonnet",
        "Дах" => "Roof",
        "Кришка багажника" => "Trunk / boot lid",
        "Двері багажника" => "Tailgate",
        "Бампер передній" => "Front bumper",
        "Бампер задній" => "Rear bumper",
        "Двері передні ліві" => "Left front door",
        "Двері передні праві" => "Right front door",
        "Двері задні ліві" => "Left rear door",
        "Двері задні праві" => "Right rear door",
        "Крило переднє ліве" => "Left front fender / wing",
        "Крило переднє праве" => "Right front fender / wing",
        "Крило заднє ліве" => "Left rear quarter panel",
        "Крило заднє праве" => "Right rear quarter panel",
        "Ремонт з зовнішнім фарбуванням" => {
            "Repair with exterior painting"
        }
        "Ремонт з фарбуваням 2 сторони" => {
            "Repair with painting both sides"
        }
        "Ремонт без фарбування" => "Repair without painting",
        "Розтонування фарби" => "Paint blending",
        "Заміна оригінал деталь з фарбуванням" => {
            "Replace with original part and paint"
        }
        "Заміна Не оригінал деталь з фарбуванням" => {
            "Replace with aftermarket part and paint"
        }
        "Заміна без фарбування" => "Replace without painting",
        "Полірування" => "Polishing",
        _ => value,
    }
    .into()
}
async fn t1_parts(
    state: &Arc<AppState>,
    email: &str,
    class: &str,
    body: &str,
) -> Result<Vec<Value>, AppError> {
    let real_body = crate::calc::cars::body_type_into_t1_entry(body);
    let rows = csv(state, email, "tables/t1.csv").await?;
    Ok(rows.as_array().unwrap().iter().filter(|r|r["Список Класс"]==class && r["Список Тип"]==real_body).map(|r|json!({"name":r["Список деталь укр"],"label_uk":r["Список деталь укр"],"label_en":r["Список деталь eng"].as_str().filter(|s|!s.is_empty()).map(String::from).unwrap_or_else(||english_label(r["Список деталь укр"].as_str().unwrap_or("")))})).collect())
}
async fn actions(
    state: &Arc<AppState>,
    email: &str,
    part: Option<&str>,
) -> Result<Vec<Value>, AppError> {
    let rows = csv(state, email, "tables/repair_types.csv").await?;
    let mut values = HashSet::new();
    for row in rows.as_array().unwrap() {
        if part.is_some_and(|p| row["Список деталь укр"] != p) {
            continue;
        }
        if let Some(repairs) = row["Ремонти"].as_str() {
            for action in repairs.split('/').map(str::trim).filter(|s| !s.is_empty()) {
                values.insert(action.to_string());
            }
        }
    }
    let mut list: Vec<_> = values.into_iter().collect();
    list.sort();
    Ok(list
        .into_iter()
        .map(|s| json!({"id":s,"label_uk":s,"label_en":english_label(&s)}))
        .collect())
}
pub async fn search(state: &Arc<AppState>, email: &str, args: &Value) -> Result<Value, AppError> {
    let kind = required(args, "kind")?;
    let query = args["query"].as_str().unwrap_or("").to_lowercase();
    let mut data = match kind {
        "vehicles" => {
            if let Some(make) = args["make"].as_str() {
                yaml(
                    state,
                    email,
                    &format!("cars/{}.yaml", relative(make)?.to_string_lossy()),
                )
                .await?
            } else {
                json!(
                    utils::list_catalog_files_user_common(&state.data_dir_path, email, &"cars")
                        .await?
                        .into_iter()
                        .map(|n| n.trim_end_matches(".yaml").to_string())
                        .collect::<Vec<_>>()
                )
            }
        }
        "class_body_types" => yaml(state, email, "tables/class_body_mapping.yaml").await?,
        "parts" => json!(
            t1_parts(
                state,
                email,
                required(args, "car_class")?,
                required(args, "body_type")?
            )
            .await?
        ),
        "subparts" => {
            let body = crate::calc::cars::body_type_into_t1_entry(required(args, "body_type")?);
            let rows = crate::calc::t2::t2_rows_by_body_type(
                &body,
                email,
                &state.data_dir_path,
                &state.cache,
            )
            .await?;
            json!(crate::calc::t2::parse_all_fail(rows)?)
        }
        "repair_actions" => json!(actions(state, email, args["part"].as_str()).await?),
        "colors" => {
            serde_json::from_slice(&catalog_bytes(state, email, "global/colors.json").await?)?
        }
        "paint_types" => yaml(state, email, "global/paint_styles.yaml").await?,
        "repair_quality" => yaml(state, email, "global/quality.yaml").await?,
        "templates" => {
            json!(crate::calc::templating::list_templates(email, &state.data_dir_path).await?)
        }
        _ => return Err(bad("Unknown catalog kind")),
    };
    if !query.is_empty() {
        data = match data {
            Value::Array(a) => json!(a
                .into_iter()
                .filter(|v| v.to_string().to_lowercase().contains(&query))
                .collect::<Vec<_>>()),
            Value::Object(o) => Value::Object(
                o.into_iter()
                    .filter(|(k, v)| format!("{k}{v}").to_lowercase().contains(&query))
                    .collect(),
            ),
            v => v,
        };
    }
    let offset = args["offset"].as_u64().unwrap_or(0) as usize;
    let limit = args["limit"].as_u64().unwrap_or(50).clamp(1, 100) as usize;
    let (items, total) = match data {
        Value::Array(a) => {
            let total = a.len();
            (
                json!(a.into_iter().skip(offset).take(limit).collect::<Vec<_>>()),
                total,
            )
        }
        Value::Object(o) => {
            let total = o.len();
            (
                Value::Object(o.into_iter().skip(offset).take(limit).collect()),
                total,
            )
        }
        v => (v, 1),
    };
    Ok(
        json!({"kind":kind,"items":items,"total":total,"next_offset":if offset+limit<total{Some(offset+limit)}else{None},"instructions_en":"Use returned identifiers verbatim. Ask the user to choose when several options match.","instructions_uk":"Використовуйте повернені ідентифікатори без змін. Якщо варіантів кілька, попросіть користувача обрати."}),
    )
}
fn owner(state: &AppState, email: &str) -> Result<String, AppError> {
    Ok(state
        .db
        .find_user_by_email(email)?
        .ok_or(AppError::Unauthorized)?
        .id
        .to_string())
}
async fn load(state: &Arc<AppState>, email: &str, id: &str) -> Result<Value, AppError> {
    let owner = owner(state, email)?;
    let draft = get::<Draft>(state, &format!("draft:{owner}:{id}"))?.ok_or(AppError::NotFound)?;
    if draft.owner_id != owner {
        return Err(AppError::NotFound);
    }
    let path = utils::user_personal_directory_from_email(&state.data_dir_path, email)?;
    let bytes = utils::safe_read(
        &path,
        &PathBuf::from(CALCULATIONS).join(relative(&draft.filename)?),
        &state.cache,
    )
    .await?;
    Ok(serde_json::from_slice(&bytes)?)
}
async fn save(state: &Arc<AppState>, email: &str, mut doc: Value) -> Result<Value, AppError> {
    let id = required(&doc, "calculationId")?.to_string();
    let owner = owner(state, email)?;
    let filename = doc["car"]["storeFileName"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| format!("mcp-{id}.json"));
    relative(&filename)?;
    doc["car"]["storeFileName"] = json!(filename);
    doc["mcpManaged"] = json!(true);
    doc["lastSavedRevision"] = doc["revision"].clone();
    let path = utils::user_personal_directory_from_email(&state.data_dir_path, email)?;
    utils::safe_write_overwrite(
        path,
        PathBuf::from(CALCULATIONS).join(&filename),
        serde_json::to_vec_pretty(&doc)?,
        &state.cache,
    )
    .await?;
    put(
        state,
        &format!("draft:{owner}:{id}"),
        &Draft {
            owner_id: owner,
            filename,
        },
    )?;
    Ok(doc)
}
fn check_revision(doc: &Value, args: &Value) -> Result<(), AppError> {
    let revision = args["expected_revision"]
        .as_u64()
        .ok_or_else(|| bad("expected_revision is required / Потрібна поточна версія"))?;
    if doc["revision"].as_u64().unwrap_or(0) != revision {
        return Err(bad("Stale revision: call get_calculation and retry / Застаріла версія: отримайте розрахунок та повторіть"));
    }
    Ok(())
}
fn validate_changes(changes: &Value) -> Result<(), AppError> {
    let allowed = [
        "car",
        "paint",
        "order",
        "parts",
        "repairQuality",
        "edits",
        "restore_rows",
        "inputOverrides",
        "refresh_sources",
    ];
    let fields = changes
        .as_object()
        .ok_or_else(|| bad("changes must be an object"))?;
    if fields.keys().any(|k| !allowed.contains(&k.as_str())) {
        return Err(bad("Unknown calculation change field"));
    }
    for field in ["car", "paint", "order"] {
        if let Some(value) = changes.get(field) {
            if !value.is_object() {
                return Err(bad("Input sections must be objects"));
            }
        }
    }
    if let Some(car) = changes.get("car") {
        if car.as_object().unwrap().keys().any(|k| {
            ![
                "make",
                "model",
                "year",
                "carClass",
                "bodyType",
                "licensePlate",
                "vin",
                "notes",
            ]
            .contains(&k.as_str())
        }) {
            return Err(bad("Unknown car field"));
        }
    }
    if let Some(edits) = changes.get("edits") {
        for edit in edits
            .as_array()
            .ok_or_else(|| bad("edits must be an array"))?
        {
            let field = required(edit, "field")?;
            if ![
                "name",
                "estimation",
                "unit",
                "price",
                "sum",
                "category",
                "orderingNum",
                "tooltip",
                "excluded",
                "total",
            ]
            .contains(&field)
            {
                return Err(bad("Unsupported cell field"));
            }
            required(edit, "entity_id")?;
            if field == "excluded" && edit["reset"] != true && !edit["value"].is_boolean() {
                return Err(bad("excluded requires a boolean value"));
            }
            if edit["reset"] != true
                && !(edit["value"].is_null()
                    || edit["value"].is_boolean()
                    || edit["value"].is_string()
                    || edit["value"].is_number())
            {
                return Err(bad("Cell value must be scalar"));
            }
        }
    }
    Ok(())
}
async fn hydrate(
    state: &Arc<AppState>,
    email: &str,
    doc: &mut Value,
    refresh: bool,
) -> Result<(), AppError> {
    // Vehicle identity is free-form. Catalog matches only help fill missing
    // calculation classifications; never validate or rewrite the user's text.
    if let (Some(make), Some(model)) = (doc["car"]["make"].as_str(), doc["car"]["model"].as_str()) {
        let makers = utils::list_catalog_files_user_common(&state.data_dir_path, email, &"cars")
            .await
            .unwrap_or_default();
        let matches: Vec<_> = makers
            .iter()
            .filter(|name| name.trim_end_matches(".yaml").eq_ignore_ascii_case(make))
            .collect();
        if matches.len() == 1 {
            if let Ok(models) = yaml(state, email, &format!("cars/{}", matches[0])).await {
                let matches: Vec<_> = models
                    .as_object()
                    .into_iter()
                    .flat_map(|o| o.iter())
                    .filter(|(name, _)| name.eq_ignore_ascii_case(model))
                    .collect();
                if matches.len() == 1 {
                    let metadata = matches[0].1;
                    if doc["car"]["carClass"].as_str().unwrap_or("").is_empty() {
                        doc["car"]["carClass"] = metadata["euro_class"].clone();
                    }
                    if doc["car"]["bodyType"].as_str().unwrap_or("").is_empty() {
                        if let Some(bodies) = metadata["euro_body_types"]
                            .as_array()
                            .filter(|a| a.len() == 1)
                        {
                            doc["car"]["bodyType"] = bodies[0].clone();
                        }
                    }
                }
            }
        }
    }
    let class = doc["car"]["carClass"].as_str().unwrap_or("").to_string();
    let body = doc["car"]["bodyType"].as_str().unwrap_or("").to_string();
    if class.is_empty() || body.is_empty() {
        return Ok(());
    }
    let mut available = t1_parts(state, email, &class, &body).await?;
    if available.is_empty() {
        return Err(bad(
            "Unknown class/body combination: search class_body_types / Невідомий клас або кузов",
        ));
    }
    let rows = crate::calc::t2::t2_rows_by_body_type(
        &crate::calc::cars::body_type_into_t1_entry(&body),
        email,
        &state.data_dir_path,
        &state.cache,
    )
    .await?;
    available.extend(
        serde_json::to_value(crate::calc::t2::parse_all_fail(rows)?)?
            .as_array()
            .unwrap()
            .iter()
            .cloned(),
    );
    if doc["parts"]["repairQuality"]
        .as_str()
        .unwrap_or("")
        .is_empty()
    {
        let quality = yaml(state, email, "global/quality.yaml").await?;
        if !doc["parts"].is_object() {
            doc["parts"] = json!({});
        }
        doc["parts"]["repairQuality"] = quality["default"].clone();
    }
    let quality = yaml(state, email, "global/quality.yaml").await?;
    if !quality["options"]
        .as_array()
        .into_iter()
        .flatten()
        .any(|v| v == &doc["parts"]["repairQuality"])
    {
        return Err(bad("Unknown repair quality; search repair_quality"));
    }
    if let Some(style) = doc["paint"]["paintType"].as_str().filter(|s| !s.is_empty()) {
        if !yaml(state, email, "global/paint_styles.yaml")
            .await?
            .as_array()
            .into_iter()
            .flatten()
            .any(|v| v == style)
        {
            return Err(bad("Unknown paint type; search paint_types"));
        }
    }
    let parts = doc["parts"]["selectedParts"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let mut unique = HashSet::new();
    let mut hydrated_parts = Vec::new();
    for part in &parts {
        let name = required(part, "name")?;
        if !unique.insert(name.to_string()) || !available.iter().any(|p| p["name"] == name) {
            return Err(bad(&format!("Unknown or duplicate part '{name}'; search parts/subparts / Невідома або повторна деталь")));
        }
        let mut hydrated = available
            .iter()
            .find(|p| p["name"] == name)
            .unwrap()
            .clone();
        for (key, value) in part.as_object().ok_or_else(|| bad("Invalid part"))? {
            hydrated[key] = value.clone();
        }
        hydrated_parts.push(hydrated);
        if let Some(action) = part["selectedAction"]
            .as_str()
            .or_else(|| part["action"].as_str())
        {
            let allowed = actions(state, email, Some(name)).await?;
            let global = actions(state, email, None).await?;
            if !(if allowed.is_empty() {
                &global
            } else {
                &allowed
            })
            .iter()
            .any(|a| a["id"] == action)
            {
                return Err(bad(
                    "Unknown repair action; search repair_actions / Невідома ремонтна операція",
                ));
            }
        }
    }
    doc["parts"]["selectedParts"] = json!(hydrated_parts);
    if refresh {
        doc["pricingSnapshot"] = json!(
            find_or_create_company_info(state, email)
                .await?
                .pricing_preferences
        );
        doc["sourceSnapshot"] = json!({});
        doc["processorSnapshot"] = Value::Null;
        doc["processorFiles"] = json!({});
        doc["processing"] = json!({});
    }
    if doc["processorSnapshot"].is_null() {
        let paths = utils::all_files_with_extension(
            &state.data_dir_path,
            email,
            "procs",
            std::ffi::OsStr::new("js"),
        )
        .await?;
        doc["processorSnapshot"] = json!(bundle_plugins_as_array(paths).await?);
    }
    for part in parts {
        let name = required(&part, "name")?;
        let context = format!("{class}/{body}");
        if doc["sourceSnapshot"][name]["context"] != context {
            let tables = crate::calc::table_processing::lookup(
                &crate::calc::cars::body_type_into_t1_entry(&body),
                &class,
                name,
                &state.data_dir_path,
                email,
                &state.cache,
            )
            .await?;
            if !doc["sourceSnapshot"].is_object() {
                doc["sourceSnapshot"] = json!({});
            }
            doc["sourceSnapshot"][name] = json!({"context":context,"tables":tables.into_iter().map(|(file,data)|json!({"name":Path::new(&file).file_stem().unwrap().to_string_lossy(),"data":data,"file":file})).collect::<Vec<_>>()});
        }
    }
    // Required file names are extracted inside the same bounded JS runtime.
    let metadata =
        engine::evaluate(state, json!({"document":doc,"inspect_processors":true})).await?;
    for file in metadata["required_files"].as_array().into_iter().flatten() {
        let file = file.as_str().ok_or_else(|| bad("Invalid required file"))?;
        if doc["processorFiles"][file].is_null() {
            let data = yaml(
                state,
                email,
                &format!("global/{}", relative(file)?.to_string_lossy()),
            )
            .await?;
            doc["processorFiles"][file] = data;
        }
    }
    Ok(())
}
async fn language(state: &Arc<AppState>, email: &str, args: &Value) -> Result<String, AppError> {
    let value = args["language"]
        .as_str()
        .map(String::from)
        .unwrap_or(find_or_create_company_info(state, email).await?.lang_output);
    if !["en", "uk", "ua"].contains(&value.as_str()) {
        return Err(bad("language must be en or uk"));
    }
    Ok(if value == "en" { "en" } else { "uk" }.into())
}
fn summary(evaluation: &Value, args: &Value, lang: &str) -> Value {
    let doc = &evaluation["document"];
    let offset = args["offset"].as_u64().unwrap_or(0) as usize;
    let limit = args["limit"].as_u64().unwrap_or(50).clamp(1, 100) as usize;
    let rows:Vec<Value>=doc["calculations"].as_object().into_iter().flat_map(|o|o.iter()).flat_map(|(part,tables)|tables.as_array().into_iter().flatten().flat_map(move|table|table["result"].as_array().into_iter().flatten().map(move|row|json!({"part":part,"table_id":table["id"],"table_name":table["name"],"row":row})))).collect();
    let total = rows.len();
    let totals = |field: &str| {
        doc[field].as_object().map(|tables| tables.iter().map(|(key, table)| (
        key.clone(), json!({"id":table["id"],"name":table["name"],"total":table["total"],"computed_total":table["computedTotal"]})
    )).collect::<serde_json::Map<String,Value>>())
    };
    let mut response = json!({
        "calculation_id":doc["calculationId"], "revision":doc["revision"],
        "saved_filename":doc["car"]["storeFileName"], "language":lang,
        "car":doc["car"], "paint":doc["paint"], "order":doc["order"], "parts":doc["parts"],
        "rates":doc["normRates"], "rate_assignments":doc["normRateOverrides"],
        "part_totals":totals("totalTables"), "category_totals":totals("categoryTables"),
        "grand_total":doc["grandTotal"], "computed_grand_total":doc["computedGrandTotal"], "grand_total_id":"grand-total",
        "missing_inputs":evaluation["missing_inputs"], "warnings":evaluation["warnings"], "invalid_cells":evaluation["invalid_cells"],
        "inactive_parts":doc["inactiveParts"], "inactive_rows":doc["inactiveRows"],
        "processing_errors":evaluation["processing_errors"], "invalid_drafts":evaluation["invalid_drafts"],
        "ready_to_finalize":evaluation["ready"], "rows":rows.into_iter().skip(offset).take(limit).collect::<Vec<_>>(),
        "total_rows":total, "next_offset":if offset+limit<total{Some(offset+limit)}else{None},
        "next_step":if lang=="en" {
            if evaluation["ready"]==true {"Review the estimate and finalize_calculation, or update cells using returned IDs."}
            else {"Ask the user for missing inputs; use search_catalog for valid choices."}
        } else {
            if evaluation["ready"]==true {"Перегляньте кошторис і створіть PDF або змініть комірки за поверненими ID."}
            else {"Запитайте відсутні дані; використовуйте search_catalog для вибору допустимих значень."}
        }
    });
    if args["include_sources"] == true {
        response["lookup_tables"] = doc["sourceSnapshot"].clone();
        response["input_overrides"] = doc["inputOverrides"].clone();
    }
    response
}
pub async fn create(state: &Arc<AppState>, email: &str, args: &Value) -> Result<Value, AppError> {
    let account_lock = state.mcp.account_lock(email).await;
    let _lock = account_lock.lock().await;
    let lang = language(state, email, args).await?;
    let company = find_or_create_company_info(state, email).await?;
    let mut doc = if let Some(filename) = args["saved_filename"].as_str() {
        let path = utils::user_personal_directory_from_email(&state.data_dir_path, email)?;
        let bytes = utils::safe_read(
            &path,
            &PathBuf::from(CALCULATIONS).join(relative(filename)?),
            &state.cache,
        )
        .await?;
        serde_json::from_slice(&bytes)?
    } else {
        json!({"car":{"year":"","carClass":"","bodyType":""},"parts":{"selectedParts":[]},"pricingSnapshot":company.pricing_preferences,"normRates":{"base":f64::from(company.pricing_preferences.norm_price.amount.clone()),"currency":company.pricing_preferences.norm_price.currency,"additional":company.pricing_preferences.norm_rates},"processorFiles":{},"order":{}})
    };
    // Legacy saved files have no rate/source snapshots. Seed missing fields only;
    // newer files keep their saved currency, rates and pricing preferences.
    let defaults = json!({"base":f64::from(company.pricing_preferences.norm_price.amount.clone()),"currency":company.pricing_preferences.norm_price.currency,"additional":company.pricing_preferences.norm_rates});
    if !doc["normRates"].is_object() {
        doc["normRates"] = json!({});
    }
    for field in ["base", "currency", "additional"] {
        if doc["normRates"][field].is_null() {
            doc["normRates"][field] = defaults[field].clone();
        }
    }
    if doc["pricingSnapshot"].is_null() {
        doc["pricingSnapshot"] = json!(company.pricing_preferences);
    }
    // Imported documents become independent drafts; never overwrite their source.
    doc["calculationId"] = json!(uuid::Uuid::new_v4().to_string());
    doc["car"]["storeFileName"] = Value::Null;
    doc["revision"] = json!(0);
    let changes = args.get("inputs").cloned().unwrap_or(json!({}));
    validate_changes(&changes)?;
    let mut result = engine::evaluate(
        state,
        json!({"document":doc,"changes":changes,"language":lang}),
    )
    .await?;
    hydrate(state, email, &mut result["document"], false).await?;
    result = engine::evaluate(
        state,
        json!({"document":result["document"],"process":true,"language":lang}),
    )
    .await?;
    result["document"] = save(state, email, result["document"].clone()).await?;
    Ok(summary(&result, args, &lang))
}
pub async fn inspect(state: &Arc<AppState>, email: &str, args: &Value) -> Result<Value, AppError> {
    let account_lock = state.mcp.account_lock(email).await;
    let _lock = account_lock.lock().await;
    let lang = language(state, email, args).await?;
    let doc = load(state, email, required(args, "calculation_id")?).await?;
    let result = engine::evaluate(state, json!({"document":doc,"language":lang})).await?;
    Ok(summary(&result, args, &lang))
}
pub async fn update(state: &Arc<AppState>, email: &str, args: &Value) -> Result<Value, AppError> {
    let account_lock = state.mcp.account_lock(email).await;
    let _lock = account_lock.lock().await;
    let lang = language(state, email, args).await?;
    let doc = load(state, email, required(args, "calculation_id")?).await?;
    check_revision(&doc, args)?;
    let mut changes = args.get("changes").cloned().unwrap_or(json!({}));
    validate_changes(&changes)?;
    let edits = changes.as_object_mut().unwrap().remove("edits");
    let restore = changes.as_object_mut().unwrap().remove("restore_rows");
    let mut result = engine::evaluate(
        state,
        json!({"document":doc,"changes":changes,"language":lang}),
    )
    .await?;
    hydrate(
        state,
        email,
        &mut result["document"],
        changes["refresh_sources"] == true,
    )
    .await?;
    result=engine::evaluate(state,json!({"document":result["document"],"changes":{"edits":edits.unwrap_or(json!([])),"restore_rows":restore.unwrap_or(json!([]))},"process":true,"language":lang})).await?;
    result["document"]["revision"] = json!(doc["revision"].as_u64().unwrap_or(0) + 1);
    result["document"] = save(state, email, result["document"].clone()).await?;
    Ok(summary(&result, args, &lang))
}
pub async fn finalize(state: &Arc<AppState>, email: &str, args: &Value) -> Result<Value, AppError> {
    let account_lock = state.mcp.account_lock(email).await;
    let _lock = account_lock.lock().await;
    let lang = language(state, email, args).await?;
    let doc = load(state, email, required(args, "calculation_id")?).await?;
    check_revision(&doc, args)?;
    let result = engine::evaluate(state, json!({"document":doc,"language":lang})).await?;
    if result["ready"] != true {
        return Ok(summary(&result, args, &lang));
    }
    let mut calculation = result["output"].clone();
    calculation["car"] = doc["car"].clone();
    calculation["paint"] = doc["paint"].clone();
    calculation["order"] = doc["order"].clone();
    let request: GeneratePdfRequest = serde_json::from_value(
        json!({"calculation":calculation,"metadata":{"order_number":doc["order"]["orderNumber"],"order_notes":doc["order"]["orderNotes"]},"template_name":args["template_name"].as_str().unwrap_or("calculation_ua.html")}),
    )?;
    let pdf = super::pdf::save_generated(
        state,
        email,
        request,
        Some(required(args, "calculation_id")?.into()),
        doc["revision"].as_u64(),
    )
    .await?;
    Ok(json!({"pdf":pdf,"calculation":summary(&result,args,&lang)}))
}
pub async fn rates(state: &Arc<AppState>, email: &str, args: &Value) -> Result<Value, AppError> {
    let account_lock = state.mcp.account_lock(email).await;
    let _lock = account_lock.lock().await;
    let mut company = find_or_create_company_info(state, email).await?;
    let scope = args["scope"].as_str().unwrap_or("calculation");
    let mut doc = if scope == "calculation" {
        let doc = load(state, email, required(args, "calculation_id")?).await?;
        check_revision(&doc, args)?;
        Some(doc)
    } else if scope == "company" {
        None
    } else {
        return Err(bad("scope must be calculation or company"));
    };
    let mut pricing: PricingPreferences = if let Some(doc) = &doc {
        serde_json::from_value(
            json!({"norm_price":{"amount":doc["normRates"]["base"],"currency":doc["normRates"]["currency"]},"norm_rates":doc["normRates"]["additional"]}),
        )?
    } else {
        company.pricing_preferences
    };
    if let Some(value) = args.get("base_amount") {
        let amount = value
            .as_f64()
            .ok_or_else(|| bad("base_amount must be a non-negative number"))?;
        if !amount.is_finite() || amount < 0.0 {
            return Err(bad("Invalid base amount"));
        }
        pricing.norm_price.amount = amount.into();
    }
    if let Some(value) = args.get("additional_rates") {
        pricing.norm_rates = serde_json::from_value::<Vec<NormRate>>(value.clone())?;
    }
    validate_pricing(&pricing)?;
    if let Some(ref mut doc) = doc {
        doc["normRates"] = json!({"base":f64::from(pricing.norm_price.amount),"currency":pricing.norm_price.currency,"additional":pricing.norm_rates});
        if let Some(assignments) = args.get("assignments") {
            for assignment in assignments
                .as_array()
                .ok_or_else(|| bad("assignments must be an array"))?
            {
                let part = required(assignment, "part")?;
                let rate = required(assignment, "rate_id")?;
                if rate != "base"
                    && !doc["normRates"]["additional"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .any(|r| r["id"] == rate)
                {
                    return Err(bad("Unknown hourly rate ID"));
                }
                if !doc["parts"]["selectedParts"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|p| p["name"] == part)
                {
                    return Err(bad("Unknown part for rate assignment"));
                }
                if !doc["normRateOverrides"].is_object() {
                    doc["normRateOverrides"] = json!({});
                }
                if !doc["normRateOverrides"][part].is_object() {
                    doc["normRateOverrides"][part] = json!({});
                }
                if assignment.get("table_id").is_some() || assignment.get("table_name").is_some() {
                    if assignment.get("table_id").is_some()
                        && assignment.get("table_name").is_some()
                    {
                        return Err(bad("Use table_id or table_name, not both"));
                    }
                    let tables = doc["generatedCalculations"][part]
                        .as_array()
                        .ok_or_else(|| bad("No generated tables for this part"))?;
                    let matches: Vec<_> = tables
                        .iter()
                        .filter(|t| {
                            if let Some(id) = assignment["table_id"].as_str() {
                                t["id"] == id
                            } else {
                                t["name"] == assignment["table_name"]
                            }
                        })
                        .collect();
                    if matches.len() != 1 {
                        return Err(bad("Unknown or ambiguous table for rate assignment"));
                    }
                    let table_id = matches[0]["id"]
                        .as_str()
                        .ok_or_else(|| bad("Table has no ID"))?
                        .to_string();
                    if !doc["normRateOverrides"][part]["tables"].is_object() {
                        doc["normRateOverrides"][part]["tables"] = json!({});
                    }
                    doc["normRateOverrides"][part]["tables"][table_id] = json!(rate);
                } else {
                    doc["normRateOverrides"][part]["rateId"] = json!(rate);
                }
            }
        }
        let lang = language(state, email, args).await?;
        let mut result = engine::evaluate(
            state,
            json!({"document":doc,"process":true,"language":lang}),
        )
        .await?;
        result["document"]["revision"] = json!(doc["revision"].as_u64().unwrap_or(0) + 1);
        result["document"] = save(state, email, result["document"].clone()).await?;
        Ok(summary(&result, args, &lang))
    } else {
        if args.get("assignments").is_some() {
            return Err(bad("Part/table assignments require calculation scope"));
        }
        company.pricing_preferences = pricing;
        save_company_info(state, email, &mut company).await?;
        Ok(json!({"scope":"company","company":company}))
    }
}
