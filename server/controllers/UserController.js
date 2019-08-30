const simplecrypt = require("simplecrypt");
const uuid = require("uuid/v4");

const User = require("../models/User");
const TeamRole = require("../models/TeamRole");
const Team = require("../models/Team");
const TeamInvite = require("../models/TeamInvintation");
const nodemail = require("../modules/nodemail");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

class UserController {
  constructor() {
    this.user = User;
    this.teamInvite = TeamInvite;
  }


  createUser(user) {
    return this.user.findOne({ where: { email: user.email } })
      .then((foundUser) => {
        if (foundUser) return new Promise((resolve, reject) => reject(new Error(409)));
        return this.user.create({
          "name": user.name,
          "surname": user.surname,
          "email": user.email,
          "password": user.password,
          "icon": user.icon,
          "active": user.active
        });
      })
      .then((newUser) => { return newUser; })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(new Error(error.message)));
      });
  }


  deleteUser(id) {
    return this.user.destroy({ where: { id } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }


  login(email, password) {
    return this.user.findOne({ where: { "email": sc.encrypt(email) } })
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

  findById(id) {
    return this.user.findOne({
      where: { "id": id },
      include: [{ model: TeamRole }],
    }).then((user) => {
      if (!user) return new Promise((resolve, reject) => reject(new Error(404)));
      return user;
    }).catch((error) => {
      return new Promise((resolve, reject) => reject(error.message));
    });
  }

  emailExists(email) {
    return this.user.findOne({ where: { "email": sc.encrypt(email) } })
      .then((user) => {
        if (user !== null) return true;
        return false;
      }).catch((error) => {
        return new Promise((resolve, reject) => reject(new Error(error)));
      });
  }

  update(id, data) {
    return this.user.update(data, { where: { "id": id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(new Error(error)));
      });
  }

  getTeamInvitesByUser(email) {
    return this.teamInvite.findAll({
      where: { email: sc.encrypt(email) },
      include: [{ model: Team }],
    })
      .then((invites) => {
        const idsArray = [];
        invites.forEach((invite) => {
          idsArray.push(invite.team_id);
        });
        if (idsArray < 1) return new Promise(resolve => resolve([]));
        return Team.findAll({ where: { id: idsArray } })
          .then((teams) => {
            return new Promise(resolve => resolve([invites, teams]));
          });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getUsersById(ids, teamId) {
    return this.user.findAll({
      where: { id: ids },
      include: [{
        model: TeamRole,
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
    return this.user.findOne({ where: { email: sc.encrypt(email) } })
      .then((user) => {
        if (!user) {
          throw new Error(404);
        }

        return this.update(user.id, { passwordResetToken: newToken });
      })
      .then((user) => {
        const hash = sc.encrypt(JSON.stringify({
          id: user.id,
          email: user.email,
        }));

        return nodemail.passwordReset({
          email: user.email,
          resetUrl: `${settings.client}/passwordReset?token=${newToken}&hash=${hash}`,
        });
      })
      .then((body) => {
        return new Promise(resolve => resolve(body));
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
          throw new Error(401);
        }

        return this.update(user.id, userUpdate);
      })
      .then(() => {
        return new Promise(resolve => resolve({ completed: true }));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }
}

module.exports = UserController;
