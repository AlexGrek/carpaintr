import { Stat, DatePicker, Tag } from 'rsuite';
import { useLocale, registerTranslations } from '../localization/LocaleContext';
import Trans from '../localization/Trans';

registerTranslations('ua', {
    "Days": "Днів",
    "Expires in": "Закінчується через",
    "Expired": "Термін дії завершився",
    "Expiration date:" : "Дата закінчення:" 
})

const LicenseVisualize = ({ license }) => {
    console.log(license);
    return <div>📜<code>{license.filename}</code>

        <div style={{ textAlign: "center" }}>
            <div className="text-sm text-gray-600">
                    {!license.expiration.isExpired && <Stat style={{ textAlign: "right" }}>
                        <Stat.Label><Trans>Expires in</Trans></Stat.Label>
                        <Stat.Value>
                            {license.expiration.daysTillExpiration} <Stat.ValueUnit><Trans>Days</Trans></Stat.ValueUnit>
                        </Stat.Value>
                    </Stat>}
                    {license.expiration.isExpired && <Tag color="red"><Trans>Expired</Trans></Tag>}
                    <p><Trans>Expiration date:</Trans><DatePicker readOnly defaultValue={license.expiration.expirationDate} /></p>
            </div>
        </div>
    </div>
}

export default LicenseVisualize;