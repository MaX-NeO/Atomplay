---
Task ID: 1
Agent: main
Task: Delete default scaffolding, clone Atomplay repo, and run the app

Work Log:
- Explored current Next.js project structure at /home/z/my-project
- Cloned https://github.com/MaX-NeO/Atomplay to /tmp/atomplay
- Stopped any existing dev server processes
- Deleted default scaffolding files (page.tsx, layout.tsx, globals.css, API routes, lib, hooks, etc.)
- Copied all Atomplay files into /home/z/my-project using rsync (excluding .git, node_modules, bun.lock)
- Installed main project dependencies with `bun install`
- Pushed Prisma schema with `bun run db:push`
- Installed mini-service dependencies (quiz-realtime)
- Fixed instrumentation.ts to use dynamic import of child_process (avoid Edge Runtime error)
- Added allowedDevOrigins for 127.0.0.1 and localhost in next.config.ts
- Started Next.js dev server on port 3000 with respawn loop
- Started quiz-realtime mini-service on port 3003
- Verified app with Agent Browser: landing page renders, Join Quiz and Admin Login flows work
- No browser console errors
- Lint passes with only 3 minor warnings (no errors)

Stage Summary:
- Atomplay (Real-Time Quiz Activity Platform) is fully running
- Next.js on port 3000, Socket.io mini-service on port 3003
- All browser interactions verified: Landing page, Join Quiz, Admin Login
- Database schema in sync (Admin, Activity, Question, Participant, Answer models)
