use crate::models::CompanyInfo;
use crate::{
    errors::AppError,
    exlogging::{log_event, LogLevel},
    utils::list_catalog_files_user_common, // Import the new CompanyInfo struct
};
use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Directory name for document templates.
///
/// This constant is used when looking up user-specific
/// or shared document templates inside the data directory.
pub const TEMPLATES: &'static str = "doc_templates";

/// Directory name for document samples.
///
/// This constant is used when looking up user-specific
/// or shared sample documents inside the data directory.
pub const SAMPLES: &'static str = "samples";

/// List all available templates for a given user.
///
/// This function will collect template file names that are either
/// specific to the user or common/shared, depending on the internal
/// implementation of `list_catalog_files_user_common`.
///
/// # Arguments
/// * `user_email` - The email of the authenticated user requesting templates.
/// * `data_dir_path` - Path to the root data directory that contains user and common catalogs.
///
/// # Returns
/// * `Ok(Vec<String>)` - A list of template file names accessible to the user.
/// * `Err(AppError)` - An error if the file system lookup or access fails.
pub async fn list_templates(
    user_email: &str,
    data_dir_path: &PathBuf,
) -> Result<Vec<String>, AppError> {
    let data = list_catalog_files_user_common(data_dir_path, user_email, &TEMPLATES)
        .await
        .map_err(|e| AppError::IoError(e))?;
    Ok(data)
}

/// List all available sample documents for a given user.
///
/// This function will collect sample file names that are either
/// specific to the user or common/shared, depending on the internal
/// implementation of `list_catalog_files_user_common`.
///
/// # Arguments
/// * `user_email` - The email of the authenticated user requesting samples.
/// * `data_dir_path` - Path to the root data directory that contains user and common catalogs.
///
/// # Returns
/// * `Ok(Vec<String>)` - A list of sample file names accessible to the user.
/// * `Err(AppError)` - An error if the file system lookup or access fails.
pub async fn list_samples(
    user_email: &str,
    data_dir_path: &PathBuf,
) -> Result<Vec<String>, AppError> {
    let data = list_catalog_files_user_common(data_dir_path, user_email, &SAMPLES)
        .await
        .map_err(|e| AppError::IoError(e))?;
    Ok(data)
}

/// Metadata attached to a document or PDF generation request.
///
/// This metadata is optional and may include references
/// to order tracking or notes provided by the user.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Metadata {
    /// Optional order number for the document (e.g., invoice or job ID).
    order_number: Option<String>,

    /// Optional notes or comments associated with the order.
    order_notes: Option<String>,
}

/// Internal request payload for PDF generation.
///
/// This structure is serialized to JSON and sent to the PDF generation API.
/// It contains either custom template content or a reference to stored templates,
/// company information, calculation data, and optional metadata.
#[derive(Debug, Deserialize, Serialize)]
pub struct GeneratePdfInternalRequest {
    /// Custom template content to override stored templates, if provided.
    pub custom_template_content: Option<String>,

    /// Company information to be included in the generated PDF.
    pub company_info: CompanyInfo,

    /// Arbitrary calculation data in JSON format, used to fill dynamic sections.
    pub calculation: serde_json::Value,

    /// Optional metadata containing order information and notes.
    pub metadata: Metadata,
}

/// Send a request to the PDF generation API.
///
/// This function builds an HTTP POST request to the given PDF generation API
/// endpoint, sending the provided request body as JSON. Errors are logged
/// and wrapped into an [`AppError`] if the request fails.
///
/// # Arguments
/// * `internal_request` - The request payload containing template, company info, calculation data, and metadata.
/// * `pdf_gen_api_url_post` - The base URL of the PDF generation API.
/// * `user_email` - Email of the authenticated user initiating the request, used for logging.
/// * `format` - Document format to generate (e.g., `"pdf"`, `"docx"`).
///
/// # Returns
/// * `Ok(Response)` - The HTTP response from the PDF generation API.
/// * `Err(AppError)` - An error if the HTTP request fails or if the API is unreachable.
pub async fn send_gen_doc_request(
    internal_request: GeneratePdfInternalRequest,
    pdf_gen_api_url_post: &str,
    user_email: &str,
    format: &str
) -> Result<Response, AppError> {
    let client = Client::new();
    Ok(client
        .post(format!("{}/{}", pdf_gen_api_url_post, format))
        .json(&internal_request)
        .send()
        .await
        .map_err(|err| {
            log_event(
                LogLevel::Error,
                format!("Document generation request failure: {:?}", err),
                Some(user_email),
            );
            AppError::InternalServerError(err.to_string())
        })?)
}
