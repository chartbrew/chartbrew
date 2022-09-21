module.exports = (user) => {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    icon: user.icon,
    active: user.active,
    tutorials: user.tutorials,
    createdAt: user.createdAt,
  };
};
