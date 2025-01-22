const simplecrypt = require("simplecrypt");
const { v4: uuid } = require("uuid");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { nanoid } = require("nanoid");
const { TOTP } = require("otpauth");
const QRCode = require("qrcode");
const { Op } = require("sequelize");

const db = require("../models/models");
const mail = require("../modules/mail");
const { decrypt, encrypt } = require("../modules/cbCrypto");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

class UserController {
  createUser(user) {
    let gNewUser;
    return db.User.findOne({ where: { email: user.email } })
      .then(async (foundUser) => {
        if (foundUser) return new Promise((resolve, reject) => reject(new Error(409)));

        const bcryptHash = await bcrypt.hash(user.password, 10);

        return db.User.create({
          name: user.name,
          email: user.email,
          password: bcryptHash,
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
          name: `${newUser.name}'s team`
        };
        return db.Team.create(newTeam);
      })
      .then((data) => {
        if (settings.teamRestricted === "1") {
          return data;
        }

        // create a default first project
        const newProject = {
          name: "My first dashboard",
          team_id: data.id,
          brewName: `my-first-dashboard-${nanoid(8)}`,
          dashboardTitle: "My first dashboard",
        };

        // create a ghost project
        const ghostProject = {
          team_id: data.id,
          name: "Ghost Project",
          brewName: `ghost-project-${nanoid(8)}`,
          dashboardTitle: "Ghost Project",
          ghost: true,
        };

        // create async
        db.Project.create(newProject);
        db.Project.create(ghostProject);

        const teamRole = {
          team_id: data.id,
          user_id: gNewUser.id,
          role: "teamOwner",
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
            if (tr.role === "teamOwner") {
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

        // delete the charts
        projects.forEach((project) => {
          promises.push(db.Chart.destroy({ where: { "project_id": project.id } }));
        });

        // delete the projects
        promises.push(db.Project.destroy({ where: { "team_id": gTeam } }));

        // delete the datasets
        promises.push(db.Dataset.destroy({ where: { "team_id": gTeam } }));

        // delete the connections
        promises.push(db.Connection.destroy({ where: { "team_id": gTeam } }));

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

  async login(email, password) {
    try {
      const foundUser = await db.User.findOne({ where: { email: { [Op.like]: email } } });

      if (!foundUser) {
        throw new Error(401);
      }

      let isAuthenticated = false;

      if (foundUser.password.startsWith("$2a$") || foundUser.password.startsWith("$2b$") || foundUser.password.startsWith("$2y$")) {
        isAuthenticated = await bcrypt.compare(password, foundUser.password);
      } else {
        isAuthenticated = (foundUser.password === sc.encrypt(password));

        if (isAuthenticated) {
          const bcryptHash = await bcrypt.hash(password, 10);
          await db.User.update({ password: bcryptHash }, { where: { email } });
        }
      }

      if (!isAuthenticated) {
        throw new Error(401);
      }

      const user2FA = await db.User2fa.findOne({
        where: { user_id: foundUser.id, isEnabled: true }
      });

      if (user2FA?.id) {
        return new Promise((resolve) => resolve({
          user_id: foundUser.id, method_id: user2FA.id, method: user2FA.method,
        }));
      }

      return foundUser;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async validate2FaLogin(userId, methodId, token) {
    const user2FA = await db.User2fa.findByPk(methodId);

    if (`${user2FA.user_id}` !== `${userId}`) {
      return new Promise((resolve, reject) => reject({ error: "User mismatch" }));
    }

    if (!user2FA) {
      return new Promise((resolve, reject) => reject({ error: "2FA method does not exist" }));
    }

    const totp = new TOTP({
      secret: user2FA.secret
    });

    const delta = totp.validate({ token, window: 1 });
    if (delta !== null) {
      const foundUser = await db.User.findOne({ where: { id: user2FA.user_id } });
      return foundUser;
    }

    if (user2FA.backup) {
      try {
        const backupCodes = JSON.parse(user2FA.backup);
        if (backupCodes.includes(token)) {
          const foundUser = await db.User.findOne({ where: { id: user2FA.user_id } });
          if (foundUser) {
            const newBackupCodes = backupCodes.filter((code) => code !== token);
            await user2FA.update({ backup: JSON.stringify(newBackupCodes) });
            return foundUser;
          }
        }
      } catch (e) {
        // do nothing
      }
    }

    return new Promise((resolve, reject) => reject(401));
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
      where: { email },
      include: [{ model: db.TeamRole }],
    }).then((user) => {
      if (!user) return new Promise((resolve, reject) => reject(new Error(404)));
      return user;
    }).catch((error) => {
      return new Promise((resolve, reject) => reject(error.message));
    });
  }

  emailExists(email) {
    return db.User.findOne({ where: { email } })
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
      where: { email },
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
      attributes: { exclude: ["password", "passwordResetToken"] },
    }).then((users) => {
      return users;
    }).catch((error) => {
      return new Promise((resolve, reject) => reject(error));
    });
  }

  requestPasswordReset(email) {
    const newToken = uuid();
    return db.User.findOne({ where: { email } })
      .then((user) => {
        if (!user) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }

        return this.update(user.id, { passwordResetToken: newToken });
      })
      .then((user) => {
        const hash = encrypt(JSON.stringify({
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

  async changePassword({ token, hash, password }) {
    // decrypt the hash to get the user information
    let user;
    try {
      user = JSON.parse(decrypt(hash));
    } catch (e) {
      return new Promise((resolve, reject) => reject(e));
    }

    // check if the existing token is valid first
    return this.findById(user.id)
      .then(async (existingUser) => {
        if (existingUser.passwordResetToken !== token) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        const bcryptHash = await bcrypt.hash(password, 10);

        const userUpdate = {
          passwordResetToken: uuid(),
          password: bcryptHash,
        };

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
    return db.User.findAll({ limit: 1 })
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

  requestEmailUpdate(id, email) {
    // check if the email is already in use
    return this.emailExists(email)
      .then((exists) => {
        if (exists) {
          return new Promise((resolve, reject) => reject(new Error(409)));
        }

        return db.User.findByPk(id);
      })
      .then((userData) => {
        const tokenPayload = {
          id: userData.id,
          email: userData.email,
          newEmail: email,
        };

        const token = jwt.sign(tokenPayload, settings.encryptionKey, {
          expiresIn: "3h",
        });

        return mail.emailUpdate({
          email,
          updateUrl: `${settings.client}/user/profile?email=${token}`,
        });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  updateEmail(id, token) {
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, settings.encryptionKey);
    } catch (e) {
      return new Promise((resolve, reject) => reject(e));
    }

    if (`${decodedToken.id}` !== `${id}`) {
      return new Promise((resolve, reject) => reject(new Error(401)));
    }

    // check if email exists
    return this.emailExists(decodedToken.newEmail)
      .then((exists) => {
        if (exists) {
          return new Promise((resolve, reject) => reject(new Error(409)));
        }

        return db.User.findByPk(id);
      })
      .then((userData) => {
        if (userData.email !== decodedToken.email) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return this.update(id, { email: decodedToken.newEmail });
      })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  generateQrCodeUrl(email, secret) {
    const totp = new TOTP({
      secret,
      issuer: "Chartbrew",
      label: email,
      digits: 6,
      period: 30,
    });

    return totp.toString();
  }

  async setup2faApp(userId) {
    const user = await this.findById(userId);
    if (!user) {
      return new Promise((resolve, reject) => reject(new Error(404)));
    }

    const secret = new TOTP().secret.base32;

    // Save secret to DB
    await db.User2fa.create({
      user_id: userId,
      secret,
      method: "app",
      isEnabled: false, // Enabled after verification only
    });

    // Generate QR Code URL
    const qrCodeURL = this.generateQrCodeUrl(user.email, secret);

    // Generate QR code
    try {
      return await QRCode.toDataURL(qrCodeURL);
    } catch (e) {
      return new Promise((resolve, reject) => reject(e));
    }
  }

  async verify2faApp(userId, { token, password }) {
    const user = await this.findById(userId);
    if (!user) {
      return new Promise((resolve, reject) => reject(new Error(404)));
    }

    // check if the password is correct
    const isCorrect = await bcrypt.compare(password, user.password);
    if (!isCorrect) {
      return new Promise((resolve, reject) => reject(new Error(401)));
    }

    const user2FA = await db.User2fa.findOne({ where: { user_id: userId } });
    if (!user2FA) {
      return new Promise((resolve, reject) => reject({ error: "2FA not setup." }));
    }

    const totp = new TOTP({
      secret: user2FA.secret
    });

    const delta = totp.validate({ token, window: 1 });
    if (delta !== null) {
      const backupCodes = [];
      for (let i = 0; i < 10; i++) {
        backupCodes.push(nanoid(8));
      }
      // Mark 2FA as enabled and add backup codes
      await user2FA.update({ isEnabled: true, backup: JSON.stringify(backupCodes) });
      return new Promise((resolve) => resolve(backupCodes));
    } else {
      return new Promise((resolve, reject) => reject({ error: "Invalid token." }));
    }
  }

  get2faMethods(userId) {
    return db.User2fa.findAll({
      where: { user_id: userId, isEnabled: true },
      attributes: { exclude: ["secret", "backup"] },
    })
      .then((methods) => {
        return new Promise((resolve) => resolve(methods));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async remove2faMethod(userId, methodId, password) {
    const user = await this.findById(userId);

    const isCorrect = await bcrypt.compare(password, user.password);
    if (!isCorrect) {
      return new Promise((resolve, reject) => reject(new Error(401)));
    }

    return db.User2fa.destroy({ where: { user_id: userId, id: methodId } })
      .then(() => {
        return new Promise((resolve) => resolve(true));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  validate2faToken(userId, token) {
    const user2FA = db.User2fa.findOne({ where: { user_id: userId, isEnabled: true } });

    if (!user2FA) {
      return new Promise((resolve, reject) => reject(new Error(404)));
    }

    const totp = new TOTP({
      secret: user2FA.secret
    });

    const delta = totp.validate({ token, window: 1 });

    if (delta !== null) {
      return this.findById(userId);
    } else {
      return new Promise((resolve, reject) => reject(new Error(401)));
    }
  }
}

module.exports = UserController;
