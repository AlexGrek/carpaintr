import YAML from 'yaml';

export const authFetchYaml = async (url, options = {}, onError = console.error) => {
    const token = localStorage.getItem('authToken');

    const headers = {
        ...options.headers,
        Authorization: token ? `Bearer ${token}` : '',
    };

    try {
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

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
};
