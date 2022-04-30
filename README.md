This is a modified version of the [Obsidian-Tasks plugin](https://github.com/schemar/obsidian-tasks) with a few additional features that I wanted.

## Features

### Color-coded priorities

The arrow emojis don't stand out enough for me, so I added some styling to color-code priorities. You can also toggle off arrow indicators by adding `hide priority` to the query (this is present in the original plugin).

<img width="274" alt="Screen Shot 2022-04-24 at 9 43 52 PM" src="https://user-images.githubusercontent.com/6182097/165007385-d20d9d85-4061-4c1f-91c6-346f1ca05d56.png">

### Additional Statuses

I found that my aggregated task lists were huge, but a lot of the tasks were in progress or blocked. It was annoying to have to read over each task to remind myself why I wasn't working on it, and I don't like staring at a huge to-do list as if I'm not making progress on it. So I added some options for statuses other than just `To Do` and `Done`:

<img width="305" alt="Screen Shot 2022-04-24 at 10 05 44 PM" src="https://user-images.githubusercontent.com/6182097/165009008-c0db778f-b952-42d4-b896-a75b90289a61.png">

The options are `To Do`, `Done`, `Blocked`, and `In Progress`. You can set them in the editing modal. Setting the task to `Done` in the editing modal will automatically set the done date to the current date, and setting a previously-done task to something else in the editing modal will _remove_ the done date. 

<img width="252" alt="Screen Shot 2022-04-24 at 10 12 12 PM" src="https://user-images.githubusercontent.com/6182097/165009481-d1b35594-f290-4740-9499-041ea15a8adf.png">

The state is preserved in the checkbox in markdown. So you can skip the editing modal and instead write markdown like:

```
- [ ] to do
- [b] blocked
- [x] done
- [/] in progress
```

Toggling the checkmark in the editor works mostly the same. Toggling the checkmark on a task when it is `Done` will set it to `To Do`. Toggling the checkmark when it is in `To Do`, `Blocked`, or `In Progress` will set it to `Done`.

### Nested tasks

## Installing
1. Copy the source code and move it to `yourvault/.obsidian/plugins/obsidian-tasks/`
2. Go to settings, then `community plugins`. Scroll to the bottom and look for `Tasks` under `installed plugins`, set the toggle on to enable the plugin.

## Issues?
I didn't test this with recurring tasks so be careful. It should probably be fine but there might be an issue with marking things done from the task modal (but probably no issues with marking them done by toggling the checkmark).
Tbh I'm probably not going to fix bugs if you file them, but feel free to submit pull requests

### Pull requests/development
It was kind of a pain to figure out how to develop obsidian plugins. [This](https://github.com/obsidianmd/obsidian-sample-plugin#first-time-developing-plugins)  might be helpful. Here are the steps I followed:

1. Clone the obsidian tasks repo
2. Make a new vault, move the repo into `newvault/.obsidian/obsidian-tasks/`. You don't have to keep it here, but otherwise you'll have to move the `main.ts`, `main.js`, and `styles.css` files into this folder manually which is kind of annoying for developing.
3. Install npm and yarn (`npm install -g yarn`) 
4. Not required, but helpful: install [this plugin](https://github.com/pjeby/hot-reload) to your test vault so obsidian will automatically reload when it sees changes to your plugin files. The reload is pretty seamless and otherwise you would have to close the vault and re-open it each time you make changes.
5. Not required, but helpful: sometimes the hot reload plugin doesn't fully work, I'm not sure why but it's clear it's not pulling the latest code. In those cases, to avoid manually having to close the vault and re-opening, you can map a hotkey to `reload app without saving`, which will reload the app and open the vault again:

    <img width="421" alt="Screen Shot 2022-04-24 at 10 02 52 PM" src="https://user-images.githubusercontent.com/6182097/165008784-52710077-bb13-4585-b481-f0737965e695.png">
