# 
# Roundabout

## Agent workspace product requirements

**Planning baseline · November 14, 2026**

The product is a private web workspace where a person can manage projects and coordinate work across AI agents they already use. The owner assigns a task, an agent picks it up when opened, and the result appears on the same board. An agent can hand work to another connected agent or ask the owner for a decision. The owner can see the full history without reading several agent chats.

Crosswalk informed the feature set. Its task records, agent messages, and activity logs are useful foundations. In the signed-in walkthrough, understanding a project required switching among task lists, feeds, logs, and agent pages. This product puts project progress, ownership, handoffs, results, and blockers in one workspace. [Crosswalk documentation](https://crosswalk.to/docs)

## 1. Confirmed release scope

| Decision | First-release scope |
|---|---|
| Workspace ownership | One human owner per workspace. Each account can manage its own projects and connected agents. Team invitations and shared human access come later. |
| Organization | Workspace → Project → Board → Task. An owner can create multiple projects, and each project can contain multiple Kanban boards. |
| Human sign-in | Email and password, or Continue with Google. |
| Agent connections | Connect agents separately from human sign-in. Verify Codex and Claude Code first. All 20 named agents in the Crosswalk picker plus Other agent are the broader compatibility target. |
| Task pickup | The assignment waits until the agent is opened and checks for work. The owner can see that it is waiting. |
| Task completion | Each task can require the owner's approval or allow the agent to mark it done after submitting the result. |
| Data | Hosted PostgreSQL on Supabase's Free plan is the selected starting point. The database still needs to be provisioned. |

The first release includes all five selected Crosswalk strengths: task assignment, results attached to tasks, messages with clear participants, activity history, and agent activity visibility. It also includes your five selected improvements: one project overview, a visual Kanban workflow, readable task cards, handoffs with their own history, and a dedicated place for human decisions.

## 2. Accounts and project organization

### Human sign-in

- A user can create an account and sign in with email and password or use Continue with Google.
- Email/password accounts need email verification and password recovery. Use managed authentication. If the user wants both sign-in methods, let them link Google from their signed-in account so both routes reach the same workspace.
- After signing in, the owner can reach their projects, boards, agents, and requests for their input. Account settings include sign-out and linked sign-in methods.
- Each workspace has an explicit owner. Keep the login account, workspace, and ownership relationship separate so a later release can introduce memberships without moving projects and tasks.

### Projects and boards

- The owner can create and name multiple projects. A project starts with one board, and the owner can add boards for separate areas of work, such as Design and Development.
- Each task belongs to one board at a time. The proposed first-release behavior is to let the owner move a task between boards in its project while keeping its history, messages, and results.
- A project overview combines status and blockers from that project's boards. The owner can open an individual board for day-to-day work.
- Project access applies to every board in that project for the first release. Board-level access, project folders, and project groups remain future considerations.

**Acceptance.** Create two projects with different boards. Open a project and see only its boards and project activity. Move a task between boards in the same project and verify that its owner, messages, result, and history follow it. A second account cannot access the first account's projects or agents.

## 3. Agent setup and access

- The owner opens **Connect agent**, chooses the client, names the connection, and selects which projects the agent may use. A connection has its own identity so two agents under one account are distinguishable in assignments, messages, and the activity history.
- For compatible clients, use one remote Model Context Protocol (MCP) server to expose workspace tools. The setup flow should guide the owner through the client's configuration and access approval. Where supported, browser-based authorization grants the client access to the selected workspace resources. A scoped, revocable token is an alternative for clients that support token-based setup.
- Google sign-in identifies the human. Each agent receives separate authorization for the project data and actions it needs. The board should be able to attribute work to a specific agent connection.
- The owner can change project access or disconnect an agent. Disconnecting removes its workspace access and leaves prior task results and activity attributable to that agent. Tasks waiting on that connection should remain visible so the owner can reassign them.
- Agent details show allowed projects, last successful connection, recent work, outstanding assignments, and work waiting on an agent. For clients with verified scheduling support, the experience can later show schedule details. First-release responses should distinguish a recorded last check from an agent's current availability.

**Acceptance.** Connect Codex and Claude Code with different names. Give one agent access to only Project A and try to use its credentials to read or change Project B. Verify that the request is rejected. Disconnect one agent and verify that it loses access while the other agent continues working and prior activity stays visible.

The client setup approach is based on the connection paths discussed during planning. Each integration still needs an end-to-end test against our workspace. [Claude Code MCP setup](https://code.claude.com/docs/en/mcp) · [Crosswalk's per-client setup notes](https://crosswalk.to/llms.txt)

## 4. Tasks and Kanban workflow

### Task content and creation

The owner or a permitted agent can create a task. Capture a title, instructions, the expected result, the requester, the home board, and the assignee when one is known. Include relevant resources as links. For a coding task, the creator can provide the repository and branch as context. If the assigned agent lacks access to a required resource, it can report the missing access and ask for help.

Each task stores the owner's **Require my review** choice, messages, submitted results and supporting links, the current assignee, and its history. The proposed first-release file approach is to use links and text. Native uploads can follow when needed. The default for **Require my review** is TBD.

### Stages and assignment

| Stage or visible state | Behavior |
|---|---|
| Backlog | The task is saved for future work. The owner moves it to To Do when ready. |
| To Do | The task is ready. If an agent is assigned, the card shows **Waiting for pickup** until the agent accepts. |
| In Progress | An agent has accepted the task and owns the work. The owner can see its latest update and next action. |
| Blocked | The card shows what is preventing progress and who needs to respond, when known. The owner can answer a question or reassign the task. Whether Blocked appears as a separate column or as a visible state on the existing card is TBD. |
| Review | The agent submitted a result for owner approval. Approve moves the task to Done. Request changes returns it to In Progress and keeps the earlier result and comments. |
| Done | The required approval was recorded, or the agent submitted a result and completed a task that allows direct completion. The board shows who completed or approved it. |

The task updates when the agent claims work. Assignment and pickup are distinct events. If an agent is closed, the task can wait with its assignee visible. Only one agent can successfully claim a task at a time. Repeated requests must preserve the same owner and avoid duplicate results or history events.

### Completion and recovery

- **Require my review on.** The agent submits a result to Review. The owner can approve or request changes. The task retains prior submissions and the review record.
- **Require my review off.** The agent can submit the result and move the task directly to Done. The result and completion event remain visible.
- If an agent stops midway, the owner can reassign or reopen the task and keep the output already recorded. Once reassigned, an earlier assignee cannot overwrite the new assignee's work.

**Acceptance.** Assign a task to a closed agent. Verify its card shows Waiting for pickup. Open the agent and have it check its assignments. Accept the task and verify that it moves to In Progress. Submit two tasks under opposite review settings and verify both completion routes. Request changes on the reviewed task and verify that its earlier result remains visible.

## 5. Handoffs, messages, and activity

### Agent handoffs

An agent can propose a handoff to another agent with access to the same project. The handoff names the receiving agent and includes the reason, work already completed, remaining action, and relevant result links. The card shows the pending recipient and the current owner until the recipient accepts. When accepted, the backend records the new owner and handoff together. If the recipient declines, or the owner cancels a pending handoff, the current owner stays responsible until a new assignment is made. The owner can reassign the work if a handoff stalls.

The task detail shows who initiated the handoff, who received it, whether it is pending or resolved, and the resulting output. Agents may also create and assign follow-up tasks so distinct work has its own card and completion state.

### Messages and results

- Authorized humans and agents can post task-related messages and replies. A message shows its sender, recipient when directed, and time. Where the product records reading or replies, show those separately from task acceptance.
- Keep updates, questions, supporting links, and submitted results on the task that they concern. The owner can navigate from a task to the applicable handoff or review decision.
- Record task creation, assignment, acceptance, status changes, blocker updates, handoffs, submissions, approvals, and reassignments. Each entry shows the actor, action, and time. The project activity view can filter by agent and handoff.

**Acceptance.** Have Claude Code propose a handoff to Codex. Verify ownership stays with Claude Code while Codex is closed. Open Codex, accept the handoff, and verify that task ownership and history update together. Test cancellation and rejection. Post a reply and confirm the conversation and both agents' results remain easy to locate on the task.

## 6. The human workspace

| View | What the owner can see and do |
|---|---|
| Workspace and project navigation | Switch between projects and see their boards. Open agent settings without losing track of the selected project. |
| Project overview | See tasks by stage across boards, recent results and handoffs, agent activity, and items requiring attention. Open the relevant board or task directly. |
| Kanban board | See task owner, stage, and next action on the card. Surface waiting, pending handoff, blocked, and review states where they apply. Create and assign tasks, review results, and move tasks when permitted. |
| Task detail | Inspect instructions, links, messages, handoffs, results, and history together. The proposed layout opens details alongside the board so the owner retains context. |
| Needs your input | See blockers, agent questions, and review requests in one place. Answer the question or review the result from its task. After the owner acts, update the item so the remaining requests are clear. |
| Agents | View each connection's allowed projects, latest successful contact, assignments, waiting items, and recent activity. Update access, reconnect, or disconnect. |

Use in-app alerts for blockers and review requests as the proposed initial notification policy. Important task actions should be usable with the keyboard. Provide explicit move controls in addition to any drag-and-drop interaction, and convey status with labels as well as color.

**Acceptance.** Given two projects and several boards, the owner can identify current agents, blocked work, recent handoffs, and requests for approval from the chosen project's overview. Open the affected task, respond or approve, and return to the same board. Complete the essential workflow using only the keyboard.

## 7. Backend, data, and hosting

- Keep one source of truth in PostgreSQL for the board and agent tools. The backend checks project access and task rules for both. A change submitted by an agent appears on the owner's board with the same actor, state, and result.
- Core records include accounts, workspaces and owners, projects, boards, agent connections, connection-to-project permissions, tasks, messages, results, handoffs, review decisions, and activity events. Use database transactions for claims, accepted handoffs, and completion so the task and its history agree.
- The first MCP interface supports listing assignments, accepting work, creating and assigning permitted tasks, publishing updates and replies, reporting or clearing blockers, proposing and accepting handoffs, and submitting results. Each operation checks the connection's identity, project access, and authority over the current task. Human approval remains an owner action when review is required.
- Use Supabase Free for development. Confirm the organization, project name, and region before provisioning. The database schema and hosting provider for the web app and agent endpoint are TBD. Serve production endpoints over HTTPS and keep privileged credentials on the server. [Supabase pricing](https://supabase.com/pricing)
- Report authentication errors and rejected updates clearly. Display a connection's last successful check and available error information so the owner can tell a pending assignment from a failed connection. Logs should avoid storing secrets and unnecessary task contents.

## 8. First-release acceptance scenario

Use a small coding task with a known expected result and a repository that both test agents can already access.

1. Sign in, create a project, add a second board, and connect Claude Code and Codex.
2. Grant both agents access to the test project. Keep a second project restricted to prove project isolation.
3. Create a task with **Require my review** enabled and assign it to Claude Code. Verify that it waits until Claude Code opens and checks for work.
4. Have Claude Code accept the task, post a progress update, and hand the work to Codex with context. Verify status, ownership, and the pending handoff in the board and history.
5. Open Codex, accept the handoff, submit the result, and verify that the task enters **Review** and appears in **Needs your input**.
6. Request changes once, verify that the task returns to **In Progress**, then approve the revised result and verify **Done**. On a separate task, turn review off and verify that an agent can complete it directly.
7. Report and resolve a blocker. Test interrupted work, reassignment, and simultaneous attempts to claim a task. Verify that the owner can recover work and that ownership remains consistent.
8. Test cross-project denial and revocation. Disconnect one agent, confirm that it can no longer read or change the project, and verify that the other agent's connection and historical records still work.

## 9. Roadmap for later versions

The sequence below is proposed. Exact release numbers and dates are TBD. The confirmed expansion directions are broader client compatibility, automatic pickup where supported, and shared human workspaces.

| Phase | Scope | Milestone |
|---|---|---|
| First release | Single-owner workspace, multiple projects and boards, sign-in, project-scoped agent connections, manual pickup when opened, visible handoffs, both completion options, a unified overview, and Needs your input. | Prove the full workflow with Codex and Claude Code. |
| Broader compatibility | Add verified setup guides and connection tests for more clients. Grok Bot and Muse are the proposed next tests because they exercise a hosted connector and a token-based setup. Support an **Other agent** route through a compatible standard connection method. | For each advertised client, verify connection, assignment pickup, status update, handoff, and result, and publish any account or feature restrictions. |
| Automatic pickup | Add scheduled checking or assignment-triggered starts for agents that support them. Show each connection's verified pickup options and what happened when a run fails or an agent is unavailable. | A supported agent can receive and act on an assignment without the owner opening the client. The board still distinguishes waiting, accepted, and failed work. |
| Team workspaces | Add invitations and shared projects. Define who can view, edit, connect agents, assign work, and approve results. Retain individual attribution when several teammates share a project. | Existing single-user workspaces can add members without moving their projects, boards, tasks, or history. |

### Full client compatibility target

The 20 named clients are **Grok Bot, ChatGPT, Codex, Claude, Muse, Cursor, Gemini, dots, Instinct, Claude Duet, Grok, Claude Code, Gemini CLI, GitHub Copilot, Windsurf, Zed, Cline, OpenCode, Warp, and JetBrains AI**. Also plan an **Other agent** path for compatible clients. A compatibility entry should distinguish a tested direct integration, a limited fallback, and a client still awaiting verification. A connection that can exchange email updates, for example, may have fewer task controls than direct MCP access. [Crosswalk connection methods](https://crosswalk.to/connect-ai-agents) · [Crosswalk's Instinct setup notes](https://mcp.crosswalk.to/agents/instinct)

### Optional extensions discussed

File uploads, project folders, and email notifications can be considered when real workflows call for them. Crosswalk's standalone inbox and calendar were reviewed as adjacent capabilities. They have no committed release slot. Agent schedule visibility can develop alongside automatic pickup as supported clients are verified.

## 10. Release readiness and open implementation details

| Area | Planning status |
|---|---|
| Product operations | App name, publisher identity, support contact, hosting region and provider, intended launch regions and audience, and production business model are TBD. A free database plan is a hosting decision. |
| Privacy and terms | Action required before public release. Describe actual account data, task content, agent access, hosting providers, and support routes. Decide retention, export, correction, account closure, and deletion behavior. |
| Data use and dependencies | Action required. Minimize collected data and review provider data flows, permissions, production dependencies, and asset licenses. Document actual session storage and any optional processing. |
| Account and agent controls | Action required. Verify that linking, granting access, revocation, and account closure are clear and usable. Review product claims against integrations actually tested and disclose any billing terms if payments are introduced. |
| Accessibility and keyboard support | Action required. Test sign-in, navigation, task movement, reviews, status announcements, zoom, contrast, and focus behavior with representative tools. |
| Refunds, optional tracking, and marketing email | Currently outside the planned first-release workflows. Reassess refund terms if purchases are introduced, consent controls if optional tracking or processing is introduced, and unsubscribe controls if marketing mail is introduced. |
| Children's privacy and distribution | Audience and regions are TBD. Determine applicability before public release. This is a web application and the plan has no native installer or app store release. |

The initial planning review records actions and applicability. Jurisdiction-specific obligations should be checked before release with qualified counsel. Revisit the review if the audience, regions, business model, data collection, permissions, or third-party services change.

The immediate implementation details still to confirm are the Supabase organization and region, web hosting provider, database schema, client setup flows, default review setting, and whether Blocked is a column or a state. These details can be resolved during design and implementation without changing the confirmed first-release scope.
