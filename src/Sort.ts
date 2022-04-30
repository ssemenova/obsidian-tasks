import type moment from 'moment';
import { Task, TaskBlock, Status } from './Task';
import type { Query, SortingProperty } from './Query';

import { getSettings } from './Settings';

type Comparator = (a: TaskBlock, b: TaskBlock) => number;

export class Sort {
    public static by(query: Pick<Query, 'sorting'>, taskBlocks: TaskBlock[]): TaskBlock[] {
        const defaultComparators: Comparator[] = [
            Sort.compareByUrgency,
            Sort.compareByStatus,
            Sort.compareByDueDate,
            Sort.compareByPriority,
            Sort.compareByPath,
        ];

        const userComparators: Comparator[] = [];

        for (const { property, reverse } of query.sorting) {
            const comparator = Sort.comparators[property];
            userComparators.push(
                reverse ? Sort.makeReversedComparator(comparator) : comparator,
            );
        }

        return taskBlocks.sort(
            Sort.makeCompositeComparator([
                ...userComparators,
                ...defaultComparators,
            ]),
        );
    }

    private static comparators: Record<SortingProperty, Comparator> = {
        urgency: Sort.compareByUrgency,
        description: Sort.compareByDescription,
        priority: Sort.compareByPriority,
        start: Sort.compareByStartDate,
        scheduled: Sort.compareByScheduledDate,
        due: Sort.compareByDueDate,
        done: Sort.compareByDoneDate,
        path: Sort.compareByPath,
        status: Sort.compareByStatus,
    };

    private static makeReversedComparator(comparator: Comparator): Comparator {
        return (a, b) => (comparator(a, b) * -1) as -1 | 0 | 1;
    }

    private static makeCompositeComparator(
        comparators: Comparator[],
    ): Comparator {
        return (a, b) => {
            for (const comparator of comparators) {
                const result = comparator(a, b);
                if (result !== 0) {
                    return result;
                }
            }
            return 0;
        };
    }

    private static compareByUrgency(a: TaskBlock, b: TaskBlock): number {
        // Higher urgency should be sorted earlier.
        function compareTask(at: Task, bt: Task): number {
            return bt.urgency - at.urgency;
        }

        // Urgency of entire block is = to the highest urgency of tasks
        if (a.tasks.length < 1) {
            return -1;
        } else if (b.tasks.length < 1) {
            return 1;
        }

        const a_sorted = [...a.tasks].sort(compareTask);
        const b_sorted = [...b.tasks].sort(compareTask);
        console.log(a_sorted, b_sorted);

        return compareTask(a_sorted[0], b_sorted[0]);
    }

    // For now, just shove any task blocks that are fully done to the bottom
    // all else should stay where it is
    private static compareByStatus(a: TaskBlock, b: TaskBlock): -1 | 0 | 1 {
        function getScore(arr: Status[]) {
            let totalTasks = arr.length;
            let initial = 0.0;
            for (let i = 0; i < totalTasks; i++) {
                let add = arr[i] == Status.Done ? 1 : 0;
                initial += add;

            }
            return initial == totalTasks;
        }

        const a_sorted = [...a.tasks].map((task) => task.status);
        const a_score = getScore(a_sorted);
        const b_sorted = [...b.tasks].map((task) => task.status);
        const b_score = getScore(b_sorted);

        return a_score < b_score
            ? -1
            : (a_score > b_score ? 1 : 0);
    }

    private static compareByPriority(a: TaskBlock, b: TaskBlock): number {
        function compareTask(at: Task, bt: Task): number {
            return at.priority.localeCompare(bt.priority);
        }

        // Priority of entire block = highest priority of tasks
        const a_sorted = [...a.tasks].sort(compareTask);
        const b_sorted = [...b.tasks].sort(compareTask);
        return compareTask(a_sorted[0], b_sorted[0]);
    }

    private static compareByStartDate(a: TaskBlock, b: TaskBlock): -1 | 0 | 1 {
        function compareTask(at: Task, bt: Task): number {
            return Sort.compareByDate(at.startDate, bt.startDate);
        }

        // Start date of entire block = earliest start date of all tasks
        const a_sorted = [...a.tasks].sort(compareTask);
        const b_sorted = [...b.tasks].sort(compareTask);
        return Sort.compareByDate(a_sorted[0].startDate, b_sorted[0].startDate);
    }

    private static compareByScheduledDate(a: TaskBlock, b: TaskBlock): -1 | 0 | 1 {
        function compareTask(at: Task, bt: Task): number {
            return Sort.compareByDate(at.scheduledDate, bt.scheduledDate);
        }

        // Scheduled date of entire block = earliest scheduled date of all tasks
        const a_sorted = [...a.tasks].sort(compareTask);
        const b_sorted = [...b.tasks].sort(compareTask);
        return Sort.compareByDate(a_sorted[0].scheduledDate, b_sorted[0].scheduledDate);
    }

    private static compareByDueDate(a: TaskBlock, b: TaskBlock): -1 | 0 | 1 {
        function compareTask(at: Task, bt: Task): number {
            return Sort.compareByDate(at.dueDate, bt.dueDate);
        }

        // Due date of entire block = earliest due date of all tasks
        const a_sorted = [...a.tasks].sort(compareTask);
        const b_sorted = [...b.tasks].sort(compareTask);
        return Sort.compareByDate(a_sorted[0].dueDate, b_sorted[0].dueDate);
    }

    private static compareByDoneDate(a: TaskBlock, b: TaskBlock): -1 | 0 | 1 {
        function compareTask(at: Task, bt: Task): number {
            return Sort.compareByDate(at.doneDate, bt.doneDate);
        }

        // Done date of entire block = latest done date of all tasks
        const a_sorted = [...a.tasks].sort(compareTask);
        const b_sorted = [...b.tasks].sort(compareTask);
        return Sort.compareByDate(a_sorted[-1].doneDate, b_sorted[-1].doneDate);
    }

    private static compareByDate(
        a: moment.Moment | null,
        b: moment.Moment | null,
    ): -1 | 0 | 1 {
        if (a !== null && b === null) {
            return -1;
        } else if (a === null && b !== null) {
            return 1;
        } else if (a !== null && b !== null) {
            if (a.isAfter(b)) {
                return 1;
            } else if (a.isBefore(b)) {
                return -1;
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }

    private static compareByPath(a: TaskBlock, b: TaskBlock): -1 | 0 | 1 {
        // All tasks in taskblock have same path
        if (a.tasks.length > 0 && b.tasks.length > 0) {
            if (a.tasks[0].path < b.tasks[0].path) {
                return -1;
            } else if (a.tasks[0].path > b.tasks[0].path) {
                return 1;
            }
        }
        return 0;
    }

    /**
     * Compare the description by how it is rendered in markdown.
     *
     * Does not use the MarkdownRenderer, but tries to match regexes instead
     * in order to be simpler, faster, and not async.
     */
    private static compareByDescription(a: TaskBlock, b: TaskBlock) {
        // Only compare top-level descriptions
        // Maybe worth one day figuring out how to compare 
        // sub-tasks but ... not today
        return Sort.cleanDescription(a.tasks[0].description).localeCompare(
            Sort.cleanDescription(b.tasks[0].description),
        );
    }

    /**
     * Removes `*`, `=`, and `[` from the beginning of the description.
     *
     * Will remove them only if they are closing.
     * Properly reads links [[like this|one]] (note pipe).
     */
    private static cleanDescription(description: string): string {
        const globalFilter = getSettings().globalFilter;
        description = description.replace(globalFilter, '').trim();

        const startsWithLinkRegex = /^\[\[?([^\]]*)\]/;
        const linkRegexMatch = description.match(startsWithLinkRegex);
        if (linkRegexMatch !== null) {
            const innerLinkText = linkRegexMatch[1];
            // For a link, we have to check whether it has another visible name set.
            // For example `[[this is the link|but this is actually shown]]`.
            description =
                innerLinkText.substring(innerLinkText.indexOf('|') + 1) +
                description.replace(startsWithLinkRegex, '');
        }

        const startsWithItalicOrBoldRegex = /^\*\*?([^*]*)\*/;
        const italicBoldRegexMatch = description.match(
            startsWithItalicOrBoldRegex,
        );
        if (italicBoldRegexMatch !== null) {
            const innerItalicBoldText = italicBoldRegexMatch[1];
            description =
                innerItalicBoldText +
                description.replace(startsWithLinkRegex, '');
        }

        const startsWithHighlightRegex = /^==?([^=]*)==/;
        const highlightRegexMatch = description.match(startsWithHighlightRegex);
        if (highlightRegexMatch !== null) {
            const innerHighlightsText = highlightRegexMatch[1];
            description =
                innerHighlightsText +
                description.replace(startsWithHighlightRegex, '');
        }

        return description;
    }
}
