# Git Audit

> Lightweight CLI to audit multiple git repository statuses at once

[![npm version](https://badge.fury.io/js/git-audit.svg)](https://badge.fury.io/js/git-audit)![NPM Downloads](https://img.shields.io/npm/dw/git-audit)![NPM License](https://img.shields.io/npm/l/git-audit)

![](header.png)

## Installation

Windows

```sh
npm install -g git-audit
```


## Usage example

Navigate to the top level of your projects directory using the commandline. Then, run git-audit to view the status of all underlying git repositories. Additionaly, the root path can be specified (default the current directory) aswell as the max-depth to look for git repositories in child directories (default 2)

> **_NOTE:_**  Only the _current_ active branch will be audited. The output will show the local branch-name.

```sh
git-audit [directory] [--max-depth={2}]
```

![Output](https://raw.githubusercontent.com/JDoggen/git-audit/master/assets/markdown/git-audit-output.png)




## Release History

* 1.0.4
    * CHANGE: Added Readme
    * CHANGE: Replaced string#replaceAll() with custom function
* 1.0.1
    * CHANGE: Small refactoring
* 1.0.0
    * Initial release
