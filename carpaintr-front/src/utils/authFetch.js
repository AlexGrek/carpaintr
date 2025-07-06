import YAML from 'yaml';
import Papa from 'papaparse';

// Common fetch functionality
const performAuthFetch = async (url, options = {}) => {
    const token = localStorage.getItem('authToken');

    const headers = {
        ...options.headers,
        Authorization: token ? `Bearer ${token}` : '',
    };

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
    }
    
    return response;
};

export const authFetchYaml = async (url, options = {}, onError = console.error) => {
    try {
        const response = await performAuthFetch(url, options);
        const text = await response.text();

        try {
            return YAML.parse(text);
        } catch (yamlError) {
            onError(`YAML parse error: ${yamlError.message}`);
            return null;
        }
    } catch (error) {
        onError(`Fetch error: ${error.message}`);
        return null;
    }
};

export const authFetchCsv = async (url, options = {}, onError = console.error) => {
    try {
        const response = await performAuthFetch(url, options);
        const text = await response.text();

        try {
            const result = Papa.parse(text, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            });
            
            if (result.errors.length > 0) {
                onError(`CSV parse errors: ${result.errors.map(e => e.message).join(', ')}`);
            }
            
            return result.data;
        } catch (csvError) {
            onError(`CSV parse error: ${csvError.message}`);
            return null;
        }
    } catch (error) {
        onError(`Fetch error: ${error.message}`);
        return null;
    }
};

export const authFetchJson = async (url, options = {}, onError = console.error) => {
    try {
        const response = await performAuthFetch(url, options);
        const data = await response.json();
        return data;
    } catch (error) {
        onError(`Fetch error: ${error.message}`);
        return null;
    }
};

export const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('authToken');

    const headers = {
        ...options.headers,
        Authorization: token ? `Bearer ${token}` : '',
    };

    const response = await fetch(url, { ...options, headers });
    return response;
};

export const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('company');
};

export const fetchCompanyInfo = async (onError = console.error) => {
    try {
        const response = await authFetch("/api/v1/getcompanyinfo")
        if (!response.ok) throw new Error('Failed to fetch company information');
        const data = await response.json();
        if (data) {
            localStorage.setItem("company", JSON.stringify(data));
            return data;
        }
        else {
            throw new Error('Failed to set company information: ', data);
        }
    } catch (e) {
        onError(e)
    }
}

export const getCompanyInfo = () => {
    const data = localStorage.getItem("company");
    if (data) {
        return JSON.parse(data);
    }
    return null;
}

export const resetCompanyInfo = () => {
    localStorage.removeItem("company");
}
