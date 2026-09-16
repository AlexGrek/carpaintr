import io
import zipfile

import click

from ..jwtutil import decode_jwt_claims, license_status
from ..output import emit


@click.command()
@click.argument("email")
@click.pass_context
def check(ctx, email):
    """Quick debug check: existence, license status, owned files."""
    client = ctx.obj["client"]
    emails = client.get("/admin/listusers").json()
    result = {"email": email, "exists": email in emails}
    if not result["exists"]:
        emit(ctx, result)
        return

    filenames = client.get(f"/admin/license/list/{email}").json()
    licenses = []
    for filename in filenames:
        try:
            token = client.get(f"/admin/license/{email}/{filename}").text
            licenses.append({"id": filename, **license_status(decode_jwt_claims(token))})
        except ValueError:
            licenses.append({"id": filename, "status": "unreadable"})
    result["licenses"] = licenses
    result["has_active_license"] = any(l["status"] == "active" for l in licenses)

    try:
        zip_resp = client.get(f"/admin/export_user_data/{email}")
        with zipfile.ZipFile(io.BytesIO(zip_resp.content)) as zf:
            result["files"] = zf.namelist()
    except (click.ClickException, zipfile.BadZipFile) as e:
        result["files"] = None
        result["files_error"] = str(e)

    emit(ctx, result)
