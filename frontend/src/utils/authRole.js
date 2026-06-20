export const isCityRole = (role) => ['city', 'city_account', 'cityUser', 'city_user', '城市账号'].includes(String(role || ''))

export const isCityUser = (user = {}) => isCityRole(user.role)
