import { Stat, DatePicker, Tag } from 'rsuite';
import { useLocale, registerTranslations } from '../localization/LocaleContext';
import Trans from '../localization/Trans';

registerTranslations('ua', {
    "Days": "Днів",
    "Expires in": "Закінчується через",
    "Expired": "Термін дії завершився",
    "Expiration date:" : "Дата закінчення:" 
})

const LicenseVisualize = ({ filename, expiration, level }) => {
    return <div>📜<code>{filename}</code>

        <div style={{ textAlign: "center" }}>
            <div className="fade-in-simple">
                    {!expiration.isExpired && <Stat style={{ textAlign: "right" }}>
                        <Stat.Label><Trans>Expires in</Trans></Stat.Label>
                        <Stat.Value>
                            {expiration.daysTillExpiration} <Stat.ValueUnit><Trans>Days</Trans></Stat.ValueUnit>
                        </Stat.Value>
                    </Stat>}
                    {expiration.isExpired && <Tag color="red"><Trans>Expired</Trans></Tag>}
                    <div style={{display: "flex", justifyContent: "space-evenly", width: "100%"}}><p><Trans>License level</Trans></p><Tag color='yellow'>{level}</Tag></div>
                    <p><Trans>Expiration date:</Trans><DatePicker readOnly defaultValue={expiration.expirationDate} /></p>
            </div>
        </div>
    </div>
}

export default LicenseVisualize;