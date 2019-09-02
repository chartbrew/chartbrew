# Contributions guide to ChartBrew

ChartBrew is currently maintained by:

* [Razvan Ilin](https://github.com/razvanilin)
* [Kate Belakova](https://github.com/belakova)

Everybody is welcome to contribute to ChartBrew and the core team will review any open PRs before merging with the codebase. Please follow this guide to ensure that the process is as smooth as possible. Any active contributor can become part of the core maintenance team if they so wish.

ChartBrew is an open-source project under the MIT license. This is the official repository and it contains all the work done by contributors.

## Contribution preparation

1. Fork the repository on your GitHub account

2. Clone from your repository and make sure you stay on `master` branch

3. [Follow the setup guide](https://docs.chartbrew.com/#getting-started), ignoring the `git clone` and including the environment setup

4. Run the project in development using the guide above and make sure everything works


## Pull requests checklist

Make sure that you work with the code on the `master` branch. There might be some cases when you contribute to an active development on another branch, but all other cases will result in your PR getting closed.

It's highly recommended that you create the PR as soon as you start development and explain it well so we know what you're working on and help when needed.

For any backend changes, make sure you have some chart data recorded in the application before submitting the PR, to help detect any bugs.

### General checks

- [ ] The PR is adding value
- [ ] The PR contains code that respects the [code style in the documentation examples](https://docs.chartbrew.com/backend)
- [ ] The PR doesn't have any ESLint errors
- [ ] The PR contains any documentation updates if needed
- [ ] The PR has an appropriate title that explains the change concisely
- [ ] The PR has a detailed description
- [ ] The PR contains small commits in the past tense `e.g. fixed the brew from spilling charts`

### Bug fixing checks

- [ ] If the PR fixes a recorded bug, please add `Fixes: #issue` in the PR description

### Frontend checks

- [ ] The `client/components/` files are not using the Redux props, any such props should be sent from `client/containers`

### Backend checks

- [ ] If the PR contains changes to the models and/or relations, the PR should include migration scripts as well (this will be documented soon)
- [ ] If migrations are needed, the PR description should contain detailed explanation as of why

## Reporting issues

The `Issues` function on GitHub should be used for reporting bugs. Have a look at the checklist before submitting an issue:

- [ ] The issue has a title that describes the problem concisely
- [ ] The body of the issue details the problem well and includes steps to reproduce, error message and screenshots where necessary
- [ ] The title and descriptions are polite
- [ ] You made sure you are using the latest release
