import React from "react";
import { Input, InputPicker } from "rsuite";

export default function MoneyEditor({ value, onChange, preferredCurrency }) {
  const { amount, currency } = value || { amount: "", currency: "" };

  // Prepare currency list
  let currencyOptions = ["UAH", "грн", "USD", "у.о."];
  if (preferredCurrency && !currencyOptions.includes(preferredCurrency)) {
    currencyOptions = [preferredCurrency, ...currencyOptions];
  }
  currencyOptions = [...new Set(currencyOptions)]; // remove duplicates

  const pickerData = currencyOptions.map((c) => ({ label: c, value: c }));

  // Regex: optional sign, digits, optional . or , with up to 2 decimals
  const moneyRegex = /^-?\d+(?:[.,]\d{0,2})?$/;
  const isAmountValid = amount === "" || moneyRegex.test(amount);

  const handleAmountChange = (newAmount) => {
    onChange({ ...value, amount: newAmount });
  };

  const handleCurrencyChange = (newCurrency) => {
    // newCurrency can be string or null
    onChange({ ...value, currency: newCurrency || "" });
  };

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <Input
        value={amount}
        onChange={handleAmountChange}
        placeholder="0.00"
        style={{
          borderColor: isAmountValid ? undefined : "red",
          color: isAmountValid ? undefined : "red",
          textAlign: "right",
        }}
      />
      <InputPicker
        data={pickerData}
        value={currency || null}
        onChange={handleCurrencyChange}
        placeholder="Currency"
        style={{ width: 140 }}
        creatable
        cleanable
      />
    </div>
  );
}
