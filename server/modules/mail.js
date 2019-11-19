/*
** This module loads the the email library of your choosing
** default: nodemailer
**
** IMPORTANT! The following methods are compulsory and need to be part of the
**            module you create (check ./nodemail.js for usage example)
** sendInvite()
** passwordReset()
*/

const sendgrid = require("./sendgrid");

module.exports = sendgrid;
