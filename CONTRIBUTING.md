# Contributions guide to ChartBrew

ChartBrew is currently maintained by:

* [Razvan Ilin](https://github.com/razvanilin)

Everybody is welcome to contribute to ChartBrew and the core team will review any open PRs before merging with the codebase. Please follow this guide to ensure that the process is as smooth as possible. Any active contributor can become part of the core maintenance team if they wish so.

ChartBrew is an open-source project under the MIT license. This is the official repository and it contains all the work done by contributors.

## Contribution preparation

1. Fork the repository on your GitHub account

2. Clone from your repository and make sure you stay on the `master` branch

3. [Follow the setup guide](https://docs.chartbrew.com/#developing-and-extending-the-application)

4. Run the project in development using the guide above and make sure everything works


## What to work on

It is recommended to check the [project roadmap](https://github.com/orgs/chartbrew/projects) to see what are the most important items you can work on.


## Pull requests checklist

Read the following:

- [ ] [Frontend](https://docs.chartbrew.com/frontend/) - if you change anything in the `client`
- [ ] [Backend](https://docs.chartbrew.com/backend/) - if you change anything in `server` 

Make sure that you work with the code on the `master` branch. There might be some cases when you contribute to an active development on another branch, but all other cases will result in your PR getting closed.

If your PR is more complex and it requires multiple commits, [create a draft PR](https://github.blog/2019-02-14-introducing-draft-pull-requests/) as soon as you push your first commit and explain what your PR does.

For any backend changes, make sure you have some chart data recorded in the application before submitting the PR, to help detect any bugs.

For any model change in the database schema, [consult the documentation](https://docs.chartbrew.com/backend/#models) and make sure that migrations are in place to modify the schema accordingly.

### General checks

- [ ] The PR is adding value
- [ ] The PR contains code that respects the [code style in the documentation examples](https://docs.chartbrew.com/backend)
- [ ] The PR doesn't have any ESLint errors
- [ ] The PR contains any documentation updates if needed
- [ ] The PR has an appropriate title that explains the change concisely
- [ ] The PR has a detailed description
- [ ] The PR contains small commits in the past tense `e.g. :bug: fixed the brew from spilling charts`
- [ ] The PR contains commits that follow the [gitmoji guidelines](https://github.com/carloscuesta/gitmoji)

### Bug fixing checks

- [ ] If the PR fixes a recorded bug, please add `Fixes: #issue` in the PR description

### Frontend checks

- [ ] The `client/components/` files are not using the Redux props, any such props should be sent from `client/containers`
- [ ] The new components should be **functional** and use [React Hooks](https://reactjs.org/docs/hooks-intro.html)

### Backend checks

- [ ] If the PR contains changes to the models and/or relations, the PR should include migration scripts as well (this will be documented soon)
- [ ] If migrations are needed, the PR description should contain detailed explanation as of why

## Reporting issues

The `Issues` function on GitHub should be used for reporting bugs. Have a look at the checklist before submitting an issue:

- [ ] The issue has a title that describes the problem concisely
- [ ] The body of the issue details the problem well and includes steps to reproduce, error message and screenshots where necessary
- [ ] The title and descriptions are polite
- [ ] You made sure you are using the latest release
