import * as chrono from 'chrono-node';

import { getSettings } from './Settings';
import { LayoutOptions } from './LayoutOptions';
import { Priority, Status, TaskBlock } from './Task';
import { Sort } from './Sort';

export type SortingProperty =
    | 'urgency'
    | 'status'
    | 'priority'
    | 'start'
    | 'scheduled'
    | 'due'
    | 'done'
    | 'path'
    | 'description';
type Sorting = { property: SortingProperty; reverse: boolean };

export class Query {
    private _limit: number | undefined = undefined;
    private _layoutOptions: LayoutOptions = new LayoutOptions();
    private _filters: ((taskBlock: TaskBlock) => boolean)[] = [];
    private _error: string | undefined = undefined;
    private _sorting: Sorting[] = [];

    private readonly priorityRegexp =
        /^priority (is )?(above|below)? ?(low|none|medium|high)/;

    private readonly happensRegexp = /^happens (before|after|on)? ?(.*)/;

    private readonly noStartString = 'no start date';
    private readonly startRegexp = /^starts (before|after|on)? ?(.*)/;

    private readonly noScheduledString = 'no scheduled date';
    private readonly scheduledRegexp = /^scheduled (before|after|on)? ?(.*)/;

    private readonly noDueString = 'no due date';
    private readonly dueRegexp = /^due (before|after|on)? ?(.*)/;

    private readonly doneString = 'done';
    private readonly notDoneString = 'not done';
    private readonly doneRegexp = /^done (before|after|on)? ?(.*)/;

    private readonly pathRegexp = /^path (includes|does not include) (.*)/;
    private readonly descriptionRegexp =
        /^description (includes|does not include) (.*)/;
    private readonly sortByRegexp =
        /^sort by (urgency|status|priority|start|scheduled|due|done|path|description)( reverse)?/;

    private readonly headingRegexp =
        /^heading (includes|does not include) (.*)/;

    private readonly hideOptionsRegexp =
        /^hide (task count|backlink|priority|start date|scheduled date|done date|due date|recurrence rule|edit button)/;
    private readonly shortModeRegexp = /^short/;

    private readonly recurringString = 'is recurring';
    private readonly notRecurringString = 'is not recurring';

    private readonly limitRegexp = /^limit (to )?(\d+)( tasks?)?/;
    private readonly excludeSubItemsString = 'exclude sub-items';

    private readonly commentRegexp = /^#.*/;

    constructor({ source }: { source: string }) {
        source
            .split('\n')
            .map((line: string) => line.trim())
            .forEach((line: string) => {
                switch (true) {
                    case line === '':
                        break;
                    case line === this.doneString:
                        this._filters.push(
                            (task) => task.tasks.every(
                                (task) => task.status === Status.Done)
                        );
                        break;
                    case line === this.notDoneString:
                        this._filters.push(
                            (task) => task.tasks.some(
                                (task) => task.status !== Status.Done)
                        );
                        break;
                    case line === this.recurringString:
                        // Sofiya: ignore recurrences of subtasks for now
                        this._filters.push((task) => task.tasks.length > 0 
                            ? task.tasks[0].recurrence !== null : false);
                        break;
                    case line === this.notRecurringString:
                        // Sofiya: ignore recurrences of subtasks for now
                        this._filters.push((task) => task.tasks.length > 0 
                            ? task.tasks[0].recurrence === null : false);
                        break;
                    case line === this.excludeSubItemsString:
                        // Sofiya: need to figure this out. How to return only
                        // top-level task in new task block?
                        this._filters.push((task) => task.tasks.length > 0 
                            ? task.tasks[0].indentation === '' : false);
                        break;
                    case line === this.noStartString:
                        // Only return true if all tasks and sub-tasks
                        // don't have start string
                        this._filters.push((task) => 
                            task.tasks.every((task) => task.startDate != null)
                        );
                        break;
                    case line === this.noScheduledString:
                        this._filters.push((task) => 
                            // Only return true if all tasks and sub-tasks 
                            // don't have scheduled string
                            task.tasks.every((task) => task.scheduledDate != null)
                        );
                        break;
                    case line === this.noDueString:
                        this._filters.push((task) =>
                            // Only return true if all tasks and sub-tasks 
                            // don't have due date
                            task.tasks.every((task) => task.dueDate != null)
                        );
                        break;
                    case this.shortModeRegexp.test(line):
                        this._layoutOptions.shortMode = true;
                        break;
                    case this.priorityRegexp.test(line):
                        this.parsePriorityFilter({ line });
                        break;
                    case this.happensRegexp.test(line):
                        this.parseHappensFilter({ line });
                        break;
                    case this.startRegexp.test(line):
                        this.parseStartFilter({ line });
                        break;
                    case this.scheduledRegexp.test(line):
                        this.parseScheduledFilter({ line });
                        break;
                    case this.dueRegexp.test(line):
                        this.parseDueFilter({ line });
                        break;
                    case this.doneRegexp.test(line):
                        this.parseDoneFilter({ line });
                        break;
                    case this.pathRegexp.test(line):
                        this.parsePathFilter({ line });
                        break;
                    case this.descriptionRegexp.test(line):
                        this.parseDescriptionFilter({ line });
                        break;
                    case this.headingRegexp.test(line):
                        this.parseHeadingFilter({ line });
                        break;
                    case this.limitRegexp.test(line):
                        this.parseLimit({ line });
                        break;
                    case this.sortByRegexp.test(line):
                        this.parseSortBy({ line });
                        break;
                    case this.hideOptionsRegexp.test(line):
                        this.parseHideOptions({ line });
                        break;
                    case this.commentRegexp.test(line):
                        // Comment lines are ignored
                        break;
                    default:
                        this._error = 'do not understand query';
                }
            });
    }

    public get limit(): number | undefined {
        return this._limit;
    }

    public get layoutOptions(): LayoutOptions {
        return this._layoutOptions;
    }

    public get filters(): ((taskBlock: TaskBlock) => boolean)[] {
        return this._filters;
    }

    public get sorting() {
        return this._sorting;
    }

    public get error(): string | undefined {
        return this._error;
    }

    private parseHideOptions({ line }: { line: string }): void {
        const hideOptionsMatch = line.match(this.hideOptionsRegexp);
        if (hideOptionsMatch !== null) {
            const option = hideOptionsMatch[1].trim().toLowerCase();

            switch (option) {
                case 'task count':
                    this._layoutOptions.hideTaskCount = true;
                    break;
                case 'backlink':
                    this._layoutOptions.hideBacklinks = true;
                    break;
                case 'priority':
                    this._layoutOptions.hidePriority = true;
                    break;
                case 'start date':
                    this._layoutOptions.hideStartDate = true;
                    break;
                case 'scheduled date':
                    this._layoutOptions.hideScheduledDate = true;
                    break;
                case 'due date':
                    this._layoutOptions.hideDueDate = true;
                    break;
                case 'done date':
                    this._layoutOptions.hideDoneDate = true;
                    break;
                case 'recurrence rule':
                    this._layoutOptions.hideRecurrenceRule = true;
                    break;
                case 'edit button':
                    this._layoutOptions.hideEditButton = true;
                    break;
                default:
                    this._error = 'do not understand hide option';
            }
        }
    }

    private parsePriorityFilter({ line }: { line: string }): void {
        const priorityMatch = line.match(this.priorityRegexp);
        if (priorityMatch !== null) {
            const filterPriorityString = priorityMatch[3];
            let filterPriority: Priority | null = null;

            switch (filterPriorityString) {
                case 'low':
                    filterPriority = Priority.Low;
                    break;
                case 'none':
                    filterPriority = Priority.None;
                    break;
                case 'medium':
                    filterPriority = Priority.Medium;
                    break;
                case 'high':
                    filterPriority = Priority.High;
                    break;
            }

            if (filterPriority === null) {
                this._error = 'do not understand priority';
                return;
            }

            let filter;
            if (priorityMatch[2] === 'above') {
                filter = (tb: TaskBlock) =>
                    // If there is some task with a priority above the 
                    // query priority, then include entire block
                    tb.tasks.some((task) =>
                        task.priority
                            ? task.priority.localeCompare(filterPriority!) < 0
                            : false
                    );
            } else if (priorityMatch[2] === 'below') {
                filter = (tb: TaskBlock) =>
                    // If there is some task with a priority above the
                    // query priority, then EXCLUDE the entire block
                    !tb.tasks.some((task) =>
                        task.priority
                            ? task.priority.localeCompare(filterPriority!) < 0
                            : false
                    );
            } else {
                filter = (tb: TaskBlock) =>
                    // If every task priority is above or equal to the 
                    // query priority, then include the entire block
                    tb.tasks.every((task) =>
                        task.priority
                            ? (task.priority === filterPriority ||
                                task.priority.localeCompare(filterPriority!) < 0)
                            : false
                    );
            }

            this._filters.push(filter);
        } else {
            this._error = 'do not understand query filter (priority date)';
        }
    }

    private parseHappensFilter({ line }: { line: string }): void {
        const happensMatch = line.match(this.happensRegexp);
        if (happensMatch !== null) {
            const filterDate = this.parseDate(happensMatch[2]);
            if (!filterDate.isValid()) {
                this._error = 'do not understand happens date';
                return;
            }

            let filter;
            if (happensMatch[1] === 'before') {
                filter = (tb: TaskBlock) => {
                    // Happens date of entire block is set to the first
                    // happens date of the block
                    return [...tb.tasks].map((task) =>
                        Array.of(
                            task.startDate,
                            task.scheduledDate,
                            task.dueDate
                        )
                    ).flat().some((date) => date && date.isBefore(filterDate));
                };
            } else if (happensMatch[1] === 'after') {
                filter = (tb: TaskBlock) => {
                    // Happens date of entire block is set to the first
                    // happens date of the block
                    return [...tb.tasks].map((task) =>
                        Array.of(
                            task.startDate,
                            task.scheduledDate,
                            task.dueDate
                        )
                    ).flat().some((date) => date && date.isAfter(filterDate));
                };
            } else {
                filter = (tb: TaskBlock) => {
                    // Happens date of entire block is set to the first
                    // happens date of the block
                    return [...tb.tasks].map((task) =>
                        Array.of(
                            task.startDate,
                            task.scheduledDate,
                            task.dueDate
                        )
                    ).flat().some((date) => date && date.isSame(filterDate));
                };
            }

            this._filters.push(filter);
        } else {
            this._error = 'do not understand query filter (happens date)';
        }
    }

    private parseStartFilter({ line }: { line: string }): void {
        const startMatch = line.match(this.startRegexp);
        if (startMatch !== null) {
            const filterDate = this.parseDate(startMatch[2]);
            if (!filterDate.isValid()) {
                this._error = 'do not understand start date';
                return;
            }

            let filter;
            if (startMatch[1] === 'before') {
                filter = (tb: TaskBlock) =>
                    // If any task start date in block is before 
                    // filter date, then all tasks are
                    tb.tasks.some((task) => task.startDate
                        ? task.startDate.isBefore(filterDate)
                        : true);
            } else if (startMatch[1] === 'after') {
                filter = (tb: TaskBlock) =>
                    // If any task start date in block is after 
                    // filter date, then all tasks are
                    tb.tasks.some((task) => task.startDate
                        ? task.startDate.isAfter(filterDate)
                        : true);
            } else {
                filter = (tb: TaskBlock) =>
                    // If any task start date in block has same 
                    // filter date, then all tasks do
                    tb.tasks.some((task) => task.startDate
                        ? task.startDate.isSame(filterDate)
                        : true);
            }

            this._filters.push(filter);
        } else {
            this._error = 'do not understand query filter (start date)';
        }
    }

    private parseScheduledFilter({ line }: { line: string }): void {
        const scheduledMatch = line.match(this.scheduledRegexp);
        if (scheduledMatch !== null) {
            const filterDate = this.parseDate(scheduledMatch[2]);
            if (!filterDate.isValid()) {
                this._error = 'do not understand scheduled date';
            }

            let filter;
            if (scheduledMatch[1] === 'before') {
                filter = (tb: TaskBlock) =>
                    // Add all tasks if any in block are scheduled at the right time
                    tb.tasks.some((task) => task.scheduledDate
                        ? task.scheduledDate.isBefore(filterDate)
                        : false);
            } else if (scheduledMatch[1] === 'after') {
                filter = (tb: TaskBlock) =>
                    // Add all tasks if any in block are scheduled at the right time
                    tb.tasks.some((task) => task.scheduledDate
                        ? task.scheduledDate.isAfter(filterDate)
                        : false);
            } else {
                filter = (tb: TaskBlock) =>
                    // Add all tasks if any in block are scheduled at the right time
                    tb.tasks.some((task) => task.scheduledDate
                        ? task.scheduledDate.isSame(filterDate)
                        : false);
            }

            this._filters.push(filter);
        } else {
            this._error = 'do not understand query filter (scheduled date)';
        }
    }

    private parseDueFilter({ line }: { line: string }): void {
        const dueMatch = line.match(this.dueRegexp);
        if (dueMatch !== null) {
            const filterDate = this.parseDate(dueMatch[2]);
            if (!filterDate.isValid()) {
                this._error = 'do not understand due date';
                return;
            }

            let filter;
            if (dueMatch[1] === 'before') {
                filter = (tb: TaskBlock) =>
                    // Add all tasks if any in block are due at the right time
                    tb.tasks.some((task) => task.dueDate
                        ? task.dueDate.isBefore(filterDate)
                        : false);
            } else if (dueMatch[1] === 'after') {
                filter = (tb: TaskBlock) =>
                    // Add all tasks if any in block are due at the right time
                    tb.tasks.some((task) => task.dueDate
                        ? task.dueDate.isAfter(filterDate)
                        : false);
            } else {
                filter = (tb: TaskBlock) =>
                    // Add all tasks if any in block are due at the right time
                    tb.tasks.some((task) => task.dueDate
                        ? task.dueDate.isSame(filterDate)
                        : false);
            }

            this._filters.push(filter);
        } else {
            this._error = 'do not understand query filter (due date)';
        }
    }

    private parseDoneFilter({ line }: { line: string }): void {
        const doneMatch = line.match(this.doneRegexp);
        if (doneMatch !== null) {
            const filterDate = this.parseDate(doneMatch[2]);
            if (!filterDate.isValid()) {
                this._error = 'do not understand done date';
                return;
            }

            let filter;
            if (doneMatch[1] === 'before') {
                filter = (tb: TaskBlock) =>
                    // Add parent task and sub-task if the sub-task is 
                    // done before the date
                    tb.tasks.every((task) => task.doneDate
                        ? task.doneDate.isBefore(filterDate)
                        : false);
            } else if (doneMatch[1] === 'after') {
                filter = (tb: TaskBlock) =>
                    // Add all tasks if all in block are done at the right time
                    tb.tasks.every((task) => task.doneDate
                        ? task.doneDate.isAfter(filterDate)
                        : false);
            } else {
                filter = (tb: TaskBlock) =>
                    // Add all tasks if all in block are done at the right time
                    tb.tasks.every((task) => task.doneDate
                        ? task.doneDate.isSame(filterDate)
                        : false);
            }

            this._filters.push(filter);
        }
    }

    private parsePathFilter({ line }: { line: string }): void {
        const pathMatch = line.match(this.pathRegexp);
        if (pathMatch !== null) {
            const filterMethod = pathMatch[1];
            if (filterMethod === 'includes') {
                this._filters.push((tb: TaskBlock) =>
                    // Paths of all tasks in task block are the same
                    tb.tasks.length > 0
                        ? this.stringIncludesCaseInsensitive(tb.tasks[0].path, pathMatch[2])
                        : false
                );
            } else if (pathMatch[1] === 'does not include') {
                this._filters.push(
                    (tb: TaskBlock) =>
                        !this.stringIncludesCaseInsensitive(
                            // Paths of all tasks in task block are the same
                            tb.tasks[0].path,
                            pathMatch[2],
                        ),
                );
            } else {
                this._error = 'do not understand query filter (path)';
            }
        } else {
            this._error = 'do not understand query filter (path)';
        }
    }

    private parseDescriptionFilter({ line }: { line: string }): void {
        const descriptionMatch = line.match(this.descriptionRegexp);
        if (descriptionMatch !== null) {
            const filterMethod = descriptionMatch[1];
            const globalFilter = getSettings().globalFilter;

            if (filterMethod === 'includes') {
                this._filters.push((tb: TaskBlock) =>
                    // If any task in task block matches description filter,
                    // then include entire block
                    tb.tasks.some((task) => 
                        this.stringIncludesCaseInsensitive(
                            // Remove global filter from description match if present.
                            // This is necessary to match only on the content of the task, not
                            // the global filter.
                            task.description.replace(globalFilter, '').trim(),
                            descriptionMatch[2],
                        )
                    )
                );
            } else if (descriptionMatch[1] === 'does not include') {
                this._filters.push((tb: TaskBlock) =>
                    // If any task in task block matches description filter,
                    // then exclude entire block
                    !tb.tasks.some((task) =>
                        this.stringIncludesCaseInsensitive(
                            // Remove global filter from description match if present.
                            // This is necessary to match only on the content of the task, not
                            // the global filter.
                            task.description.replace(globalFilter, '').trim(),
                            descriptionMatch[2],
                        )
                    )
                );
            } else {
                this._error = 'do not understand query filter (description)';
            }
        } else {
            this._error = 'do not understand query filter (description)';
        }
    }

    private parseHeadingFilter({ line }: { line: string }): void {
        const headingMatch = line.match(this.headingRegexp);
        if (headingMatch !== null) {
            const filterMethod = headingMatch[1].toLowerCase();
            if (filterMethod === 'includes') {
                this._filters.push((tb: TaskBlock) =>
                    // If any task in task block matches heading filter,
                    // then include entire block
                    tb.tasks.some((task) =>
                        task.precedingHeader !== null &&
                        this.stringIncludesCaseInsensitive(
                            task.precedingHeader,
                            headingMatch[2],
                        )
                    )
                );
            } else if (headingMatch[1] === 'does not include') {
                this._filters.push((tb: TaskBlock) =>
                    // If any task in task block matches heading filter,
                    // then exclude entire block
                    !tb.tasks.some((task) =>
                        task.precedingHeader !== null &&
                        this.stringIncludesCaseInsensitive(
                            task.precedingHeader,
                            headingMatch[2],
                        )
                    )
                );
            } else {
                this._error = 'do not understand query filter (heading)';
            }
        } else {
            this._error = 'do not understand query filter (heading)';
        }
    }

    private parseLimit({ line }: { line: string }): void {
        const limitMatch = line.match(this.limitRegexp);
        if (limitMatch !== null) {
            // limitMatch[2] is per regex always digits and therefore parsable.
            const limit = Number.parseInt(limitMatch[2], 10);
            this._limit = limit;
        } else {
            this._error = 'do not understand query limit';
        }
    }

    private parseSortBy({ line }: { line: string }): void {
        const fieldMatch = line.match(this.sortByRegexp);
        if (fieldMatch !== null) {
            this._sorting.push({
                property: fieldMatch[1] as SortingProperty,
                reverse: !!fieldMatch[2],
            });
        } else {
            this._error = 'do not understand query sorting';
        }
    }

    private parseDate(input: string): moment.Moment {
        // Using start of day to correctly match on comparison with other dates (like equality).
        return window.moment(chrono.parseDate(input)).startOf('day');
    }

    private stringIncludesCaseInsensitive(
        haystack: string,
        needle: string,
    ): boolean {
        return haystack
            .toLocaleLowerCase()
            .includes(needle.toLocaleLowerCase());
    }
}
