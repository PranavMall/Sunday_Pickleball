#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## user_problem_statement: "Picklewood Milestone 2 Part A (Foundations): fix input bugs (lag/double-shot + Android back gesture), add hit sounds (expo-audio, one per contact, mute toggle in pause), and prepare engine architecture (roadmap §11: match-config-as-data, team-size config + SINGLES, parametric AI profiles, stat multipliers, match-result logging, layered character contract, service interfaces). Doubles must PLAY THE SAME as before (parity). Client-only Expo + Skia game; no backend."

## frontend:
##   - task: "Single-gesture input + wind-up + one contact event (no double shot)"
##     implemented: true
##     working: "NA"
##     file: "app/match.tsx, src/game/sim/GameSimulation.ts"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Replaced pan+tap Exclusive with a single Pan; wind-up pose on valid swipe; sim emits one ContactEvent per strike. Headless probe: double-fired gesture yields ONE contact. Needs UI verify: a swipe during rally produces a shot and score advances; no visual double-hit."
##   - task: "Pause menu = Resume / Sound(mute) / Restart / Quit; mute label toggles"
##     implemented: true
##     working: "NA"
##     file: "app/match.tsx, src/game/services/sfx.ts"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Pause overlay now has Resume, Sound: On/Off (persisted), Restart, Quit to Menu. Verify mute button toggles its label and overlay is exclusive with result."
##   - task: "Dev-only 1v1 singles launch + singles engine play"
##     implemented: true
##     working: "NA"
##     file: "app/difficulty.tsx, src/game/config/matchConfig.ts, src/game/sim/*"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Dev 1v1 button on difficulty screen → match?singles=1. 119 headless tests pass incl. 20 singles. Verify the match loads (score shows 2 numbers, no server number) and plays."
##   - task: "Quick match still plays the same (doubles parity) + result/rematch"
##     implemented: true
##     working: "NA"
##     file: "app/match.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Quick match now launches from quickMatchConfig. Parity fingerprint byte-for-byte identical before/after. Verify menu->difficulty->match->serve->rally->result->REMATCH works."

## metadata:
##   created_by: "main_agent"
##   version: "2.2"
##   test_sequence: 6

## test_plan:
##   current_focus:
##     - "First-time identity prompt (Player/Team name) -> main menu"
##     - "Main-menu shell: Quick Match / Match History / Profile active; Career/Training/Passport/Trophy Room Coming Soon"
##     - "Profile screen: edit + persist Player/Team name"
##     - "Match History screen: stats header, rows newest-first, empty state"
##     - "Line-free gameplay court renders with aligned code lines; HUD shows player name; result shows team name"
##   stuck_tasks: []
##   test_all: false
##   test_priority: "high_first"

## agent_communication:
##     -agent: "main"
##     -message: "PHASE 0 VALUE PASS — two commits. Client-only Expo+Skia, NO backend; verify FRONTEND on web preview only. COMMIT A (court + kitchen): (1) match screen now uses a NEW line-free court image with code-drawn lines/net on top — verify match-screen renders court + players + HUD, no red error, lines look aligned (no double lines); (2) kitchen-line + post-kitchen fairness are ENGINE changes proven by 138/138 headless tests — do NOT try to verify via UI. COMMIT B (identity/history/menu): FIRST-TIME FLOW: fresh launch shows an identity prompt (testID 'identity-prompt') with 'player-name-input' + 'team-name-input', 'identity-save-button' (Let's play) and 'identity-skip-button' (Skip for now); entering 2-16 char names and saving closes it to the main menu; Skip uses defaults Player/Picklewood. Validation: a 1-char name shows 'identity-error'. MAIN MENU (testID 'main-menu-screen'): three ACTIVE rows — 'menu-quick-match' -> difficulty, 'menu-history' -> Match History, 'menu-profile' -> Profile; four LOCKED rows 'menu-career'/'menu-training'/'menu-passport'/'menu-trophy' marked SOON that do NOT navigate (tapping shows a 'coming-soon-toast', no broken nav). QUICK MATCH: menu -> Quick Match -> difficulty -> CLUB -> match -> let it play to a result (or just confirm it loads & HUD advances) -> the HUD serve label shows the player name (not 'You') -> result overlay shows 'result-team-name' (Team <name>). MATCH HISTORY ('history-screen'): shows stat header (Played/Wins/Win %/Longest rally) and either rows ('history-row') newest-first or the empty state ('history-empty' = 'No matches yet'). PROFILE ('profile-screen'): edit player/team via 'player-name-input'/'team-name-input', Save ('identity-save-button'), reopen screen -> values persisted ('profile-saved' appears on save). NOT verifiable on web (do NOT fail): native FPS, haptics, audio (disabled by design). Report any crash/red screen or broken nav."

## previous_frontend_tasks:
##   - task: "Single-gesture input + wind-up + one contact event (no double shot)"
##     implemented: true
##     working: "NA"
##     file: "app/match.tsx, src/game/sim/GameSimulation.ts"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Part A input pass; approved by user — FROZEN this pass (do not change swipe/arming/wind-up)."
