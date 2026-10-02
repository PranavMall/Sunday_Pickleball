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
##   version: "2.0"
##   test_sequence: 3

## agent_communication:
##     -agent: "main"
##     -message: "Milestone 2 Part A. Client-only Expo+Skia game, NO backend. Please verify FRONTEND flows on the web preview only: (1) main menu PLAY -> difficulty -> tap CLUB -> match loads and renders the court + players; (2) swipe UP to serve, then swipe to hit during a rally — a shot fires and the score/rally HUD updates; play until a point is scored; (3) Pause (top-right ⏸) overlay shows exactly Resume, 'Sound: On'/'Sound: Off' (tapping it toggles the label), Restart, Quit to Menu — and NO Share, no result overlay behind it; Resume returns to play; (4) Restart starts a fresh match; (5) from the difficulty screen the dev button 'DEV · 1v1 singles (CLUB)' loads a match whose score shows TWO numbers (no third server number) and plays; (6) let a match finish (or it's slow — just confirm the loop runs) to see the result overlay with REMATCH/Main Menu/Share. NOT VERIFIABLE on web (do not fail these): hit SOUNDS, HAPTICS, and the ANDROID BACK gesture — these require a real device. Just confirm nothing crashes and the above flows work. Credentials: none."
