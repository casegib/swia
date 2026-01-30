- [ ] Verify that the copilot-instructions.md file in the .github directory is created.

- [ ] Clarify Project Requirements
	- Ask for project type, language, and frameworks if not specified. Skip if already provided.

- [ ] Scaffold the Project
	- Ensure that the previous step has been marked as completed.
	- Call project setup tool with projectType parameter.
	- Run scaffolding command to create project files and folders using '.'.
	- If no appropriate projectType is available, search documentation using available tools.
	- Otherwise, create the project structure manually using available file creation tools.

- [ ] Customize the Project
	- Verify that all previous steps have been completed and marked complete.
	- Develop a plan to modify the codebase according to user requirements.
	- Apply modifications using appropriate tools and user-provided references.
	- Skip this step for "Hello World" projects.

- [ ] Install Required Extensions
	- Only install extensions mentioned by the get_project_setup_info tool. Skip otherwise and mark as completed.

- [ ] Compile the Project
	- Verify that all previous steps have been completed.
	- Install any missing dependencies.
	- Run diagnostics and resolve any issues.
	- Check project markdown files for instructions on how to do this.

- [ ] Create and Run Task
	- Verify that all previous steps have been completed.
	- Check https://code.visualstudio.com/docs/debugtest/tasks to determine if the project needs a task. If so, use create_and_run_task based on package.json, README.md, and project structure.
	- Skip this step otherwise.

- [ ] Launch the Project
	- Verify that all previous steps have been completed.
	- Prompt user for debug mode, launch only if confirmed.

- [ ] Ensure Documentation is Complete
	- Verify that all previous steps have been completed.
	- Verify that README.md and the copilot-instructions.md file in the .github directory exist and contain current project information.
	- Remove HTML comments from the copilot-instructions.md file in the .github directory.
	- Provide clear instructions to debug/launch the project as needed.

- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
- Use '.' as the working directory unless the user specifies otherwise.
- Avoid adding media or external links unless explicitly requested.
- Use placeholders only with a note that they should be replaced.
- Ensure all generated components serve a clear purpose within the user's requested workflow.
- If a feature is assumed but not confirmed, prompt the user for clarification before including it.
- If working on a VS Code extension, use the VS Code API tool with a query to find relevant VS Code API references and samples related to that query.
- Always use the current directory as the project root and do not create new folders unless requested (besides .vscode for tasks).
- Only install extensions specified by get_project_setup_info.
- If the user has not specified project details, assume they want a "Hello World" project as a starting point.
