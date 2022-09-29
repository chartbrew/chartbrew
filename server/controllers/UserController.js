const simplecrypt = require("simplecrypt");
const uuid = require("uuid/v4");

const db = require("../models/models");
const mail = require("../modules/mail");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

class UserController {
  createUser(user) {
    let gNewUser;
    return db.User.findOne({ where: { email: user.email } })
      .then((foundUser) => {
        if (foundUser) return new Promise((resolve, reject) => reject(new Error(409)));
        return db.User.create({
          name: user.name,
          oneaccountId: user.oneaccountId,
          email: user.email,
          password: user.password,
          icon: user.icon,
          active: true,
        });
      })
      .then((newUser) => {
        gNewUser = newUser;

        if (settings.teamRestricted === "1") {
          return newUser;
        }

        const newTeam = {
          name: `${newUser.name}'s space`
        };
        return db.Team.create(newTeam);
      })
      .then((data) => {
        if (settings.teamRestricted === "1") {
          return data;
        }

        const teamRole = {
          team_id: data.id,
          user_id: gNewUser.id,
          role: "owner",
          canExport: true,
        };
        return db.TeamRole.create(teamRole);
      })
      .then(() => {
        return gNewUser;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(new Error(error.message)));
      });
  }

  deleteUser(id) {
    let gTeam;
    return db.SavedQuery.destroy({ where: { "user_id": id } })
      .then(() => {
        return db.TeamRole.findAll({ where: { "user_id": id } });
      })
      .then((teamRoles) => {
        const promises = [];
        if (teamRoles.length > 0) {
          teamRoles.forEach((tr) => {
            if (tr.role === "owner") {
              gTeam = tr.team_id;
              promises.push(db.Team.destroy({ where: { "id": tr.team_id } }));
            }
            promises.push(db.TeamRole.destroy({ where: { "user_id": id } }));
          });
        }

        return Promise.all(promises);
      })
      .then(() => {
        return db.Project.findAll({ where: { "team_id": gTeam } });
      })
      .then((projects) => {
        const promises = [];
        projects.forEach((project) => {
          promises.push(db.Chart.destroy({ where: { "project_id": project.id } }));
          promises.push(db.Connection.destroy({ where: { "project_id": project.id } }));
        });
        promises.push(db.Project.destroy({ where: { "team_id": gTeam } }));

        return Promise.all(promises);
      })
      .then(() => {
        return db.User.destroy({ where: { id } });
      })
      .then(() => {
        return { deleted: true };
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  login(email, password) {
    return db.User.findOne({ where: { "email": sc.encrypt(email) } })
      .then((foundUser) => {
        if (!foundUser) return new Promise((resolve, reject) => reject(new Error(404)));
        if (!(foundUser.password === sc.encrypt(password))) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return foundUser;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(new Error(error.message)));
      });
  }

  findAll() {
    return db.User.findAll({
      attributes: { exclude: ["password", "passwordResetToken"] },
    })
      .then((users) => {
        return Promise.resolve(users);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  findById(id) {
    return db.User.findOne({
      where: { "id": id },
      include: [{ model: db.TeamRole }],
    }).then((user) => {
      if (!user) return new Promise((resolve, reject) => reject(new Error(404)));
      return user;
    }).catch((error) => {
      return new Promise((resolve, reject) => reject(error.message));
    });
  }

  findByEmail(email) {
    return db.User.findOne({
      where: { "email": sc.encrypt(email) },
      include: [{ model: db.TeamRole }],
    }).then((user) => {
      if (!user) return new Promise((resolve, reject) => reject(new Error(404)));
      return user;
    }).catch((error) => {
      return new Promise((resolve, reject) => reject(error.message));
    });
  }

  emailExists(email) {
    return db.User.findOne({ where: { "email": sc.encrypt(email) } })
      .then((user) => {
        if (user !== null) return true;
        return false;
      }).catch((error) => {
        return new Promise((resolve, reject) => reject(new Error(error)));
      });
  }

  update(id, data) {
    return db.User.update(data, { where: { "id": id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(new Error(error)));
      });
  }

  getTeamInvitesByUser(email) {
    return db.TeamInvitation.findAll({
      where: { email: sc.encrypt(email) },
      include: [{ model: db.Team }],
    })
      .then((invites) => {
        const idsArray = [];
        invites.forEach((invite) => {
          idsArray.push(invite.team_id);
        });
        if (idsArray < 1) return new Promise((resolve) => resolve([]));
        return db.Team.findAll({ where: { id: idsArray } })
          .then((teams) => {
            return new Promise((resolve) => resolve([invites, teams]));
          });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getUsersById(ids, teamId) {
    return db.User.findAll({
      where: { id: ids },
      include: [{
        model: db.TeamRole,
        where: {
          team_id: teamId
        }
      }],
    }).then((users) => {
      return users;
    }).catch((error) => {
      return new Promise((resolve, reject) => reject(error));
    });
  }

  requestPasswordReset(email) {
    const newToken = uuid();
    return db.User.findOne({ where: { email: sc.encrypt(email) } })
      .then((user) => {
        if (!user) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }

        return this.update(user.id, { passwordResetToken: newToken });
      })
      .then((user) => {
        const hash = sc.encrypt(JSON.stringify({
          id: user.id,
          email: user.email,
        }));

        return mail.passwordReset({
          email: user.email,
          resetUrl: `${settings.client}/passwordReset?token=${newToken}&hash=${hash}`,
        });
      })
      .then((body) => {
        return new Promise((resolve) => resolve(body));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  changePassword({ token, hash, password }) {
    // decrypt the hash to get the user information
    let user;
    try {
      user = JSON.parse(sc.decrypt(hash));
    } catch (e) {
      return new Promise((resolve, reject) => reject(e));
    }

    const userUpdate = {
      passwordResetToken: uuid(),
      password,
    };

    // check if the existing token is valid first
    return this.findById(user.id)
      .then((existingUser) => {
        if (existingUser.passwordResetToken !== token) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return this.update(user.id, userUpdate);
      })
      .then(() => {
        return new Promise((resolve) => resolve({ completed: true }));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  areThereAnyUsers() {
    return db.User.findAll()
      .then((users) => {
        if (!users || users.length === 0) {
          return false;
        }
        return true;
      })
      .catch((err) => {
        return err;
      });
  }
}

module.exports = UserController;
