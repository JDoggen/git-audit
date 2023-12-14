#!/usr/bin/env node
import minimist from 'minimist';
import { Dir, lstatSync, opendirSync, readdirSync } from 'fs';
import { exec } from 'child_process';
import { join } from 'path';
import colors from 'colors'

async function run() {
    const argv = minimist(process.argv);
    let path: string = argv._[2];
    let maxDepth: number | string = argv['max-depth']
    if (argv['help'] === true || path === 'help') {
        displayHelp();
        return;
    }

    if (!path) {
        console.log('No path specified, using current directory');
        path = process.cwd();
    }
    console.log(path);



    if (!maxDepth) {
        maxDepth = 2
    } else {
        if (typeof maxDepth !== 'number' || maxDepth < 0) {
            console.error('Invalid max-depth ' + maxDepth);
            return;
        }
    }



    try {
        const rootDir = opendirSync(path);
        const statusList = await read(rootDir, 0, maxDepth);
        const columns: Column[] = [
            { property: 'path', header: 'Path' },
            { property: 'localBranch', header: 'Local Branch' },
            { property: 'upstreamBranch', header: 'Upstream' },
            { property: 'ahead', header: 'Ahead' },
            { property: 'uncommitted', header: 'Uncommitted Changes' },
            { property: 'untrackedFiles', header: 'Untracked Files' }
        ];

        statusList.forEach((record) => {
            record.path = record.path.replace(replaceAll(path, '\\\\', '\\'), '.\\');
        })

        for (const column of columns) {
            column.maxLength = getColumnMaxLength(column.header, column.property, statusList);
        }

        console.log(
            columns
                .map(x => rightPad(x.header, x.maxLength!))
                .join('|')
        );

        for (const status of statusList) {
            if (status.error) {
                console.log(rightPad(status.path, columns.find(x => x.property === 'path')?.maxLength!) + '|' + colors.red('Unable to retrieve Git status'));
            } else {
                console.log(
                    columns
                        .map(column => {
                            let value = rightPad(status[column.property], column.maxLength!);
                            if (column.property === 'ahead') {
                                if (value.indexOf('yes') >= 0) {
                                    value = colors.red(value);
                                } else if (value.indexOf('no') >= 0) {
                                    value = colors.green(value);
                                } else {
                                    value = colors.yellow(value);
                                }
                            }

                            if (column.property === 'uncommitted') {
                                if (value.indexOf('yes') >= 0) {
                                    value = colors.red(value);
                                } else if (value.indexOf('no') >= 0) {
                                    value = colors.green(value);
                                } else {
                                    value = colors.yellow(value);
                                }
                            }

                            if (column.property === 'untrackedFiles') {
                                if (value.indexOf('yes') >= 0) {
                                    value = colors.red(value);
                                } else if (value.indexOf('no') >= 0) {
                                    value = colors.green(value);
                                } else {
                                    value = colors.yellow(value);
                                }
                            }
                            return value;
                        })
                        .join('|')
                );
            }
        }

    } catch (err) {
        console.error(err);
    }

}


async function read(dir: Dir, depth: number, maxDepth: number): Promise<GitStatus[]> {
    const statuses: GitStatus[] = [];
    const files = readdirSync(dir.path);
    for (const file of files) {
        const path = join(dir.path, file)
        const stat = lstatSync(path);

        let isRepo = false;

        if (stat.isDirectory()) {
            if (file === '.git') {
                isRepo = true;
            } else if (maxDepth > depth) {
                const subStatuses = await read(opendirSync(path), depth + 1, maxDepth);
                for (const status of subStatuses) {
                    statuses.push(status);
                }
            }
        }

        if (isRepo) {
            statuses.push(await getRepoStatus(dir))
        }
    }
    dir.close();
    return statuses;
}

function getColumnMaxLength(header: string, property: keyof GitStatus, records: GitStatus[]): number {
    let current = header.length;
    for (const record of records) {
        if (!!record[property] && typeof record[property] === 'string') {
            if ((<string>record[property]).length > current) {
                current = (<string>record[property]).length;
            }
        }
    }
    return current;
}

function getRepoStatus(dir: Dir): Promise<GitStatus> {
    return new Promise((resolve) => {
        exec('git status', {
            cwd: dir.path
        }, (error, stdout, stderr) => {
            const status: GitStatus = <GitStatus>{
                path: dir.path
            }
            if (error) {
                status.error = error;
                resolve(status);
                return;
            } else {
                getLocalBranch(stdout, status);
                getUpstreamBranch(stdout, status);
                getUncomitted(stdout, status);
                getUntrackedFiles(stdout, status);
                resolve(status);
            }
        });
    })
}

function getLocalBranch(stdout: string, gitStatus: GitStatus): void {
    const line = stdout.split('\n')[0];
    if (line && line.indexOf('On branch') >= 0) {
        gitStatus.localBranch = line.split('On branch')[1].trim();
    } else {
        gitStatus.localBranch = 'unknown';
    }
}

function getUpstreamBranch(stdout: string, gitStatus: GitStatus): void {
    const line = stdout.split('\n')[1];
    if (line && line.indexOf('Your branch is up to date with') >= 0) {
        gitStatus.upstreamBranch = replaceAll(replaceAll(line.split('Your branch is up to date with')[1].trim(), '\'', ''), '.', '');
        gitStatus.ahead = 'no';
    } else if (line && line.indexOf('Your branch is ahead of') >= 0) {
        gitStatus.upstreamBranch = replaceAll(replaceAll(line.split('Your branch is ahead of')[1].split(' ')[1].trim(), '\'', ''), '.', '');
        gitStatus.ahead = 'yes';
    } else {
        gitStatus.upstreamBranch = 'unknown';
        gitStatus.ahead = 'no';
    }
}


function getUncomitted(stdout: string, gitStatus: GitStatus): void {
    if (stdout.indexOf('Changes to be committed') >= 0 || stdout.indexOf('Changes not staged for commit') >= 0) {
        gitStatus.uncommitted = 'yes';
    } else {
        gitStatus.uncommitted = 'no';
    }
}

function getUntrackedFiles(stdout: string, gitStatus: GitStatus): void {
    if (stdout.indexOf('untracked files present') >= 0 || stdout.indexOf('Untracked files:') >= 0) {
        gitStatus.untrackedFiles = 'yes';
    } else {
        gitStatus.untrackedFiles = 'no';
    }
}

function getUpToDate(stdout: string): boolean {
    return true;
}

function displayHelp(): void {
    console.log('git-audit [directory] [--max-depth={2}]');
}

function rightPad(value: string, length: number, character: string = ' '): string {
    if (!value) { return character.repeat(length); }
    let visible = value.length;
    while (visible < length) {
        value += character;
        visible++;
    }
    return value;
}


function replaceAll(value: string, searchValue: string, replaceValue: string): string {
    while(value.indexOf(searchValue) >= 0) {
        value = value.replace(searchValue, replaceValue);
    }
    return value;
}

run();

interface GitStatus {
    path: string;
    localBranch: string;
    upstreamBranch: string;
    error: any | undefined;
    upToDate: string;
    ahead: string;
    uncommitted: string;
    untrackedFiles: string;
}

interface Column {
    property: keyof GitStatus,
    header: string,
    maxLength?: number
}