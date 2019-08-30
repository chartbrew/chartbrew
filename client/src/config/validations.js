export const required = value => (value ? undefined : "This field is required");

export const email = value => (value && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(value) ? "Invalid email address" : undefined);

export const password = value => (value && !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/i.test(value) ? "Minimum 8 characters, at least 1 letter and 1 number" : undefined);
