export const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('authToken');

    const headers = {
        ...options.headers,
        Authorization: token ? `${token}` : '',
    };

    const response = await fetch(url, { ...options, headers });
    return response;
};

export const logout = () => {
    localStorage.removeItem('authToken');
};
