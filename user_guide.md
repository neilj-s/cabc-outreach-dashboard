# Ministry Management Dashboard - User Guide

Welcome to the **Ministry Management Dashboard**, your centralized command center for organizing events, managing volunteers, tracking budgets, and ensuring flawless day-of operations. This application is a comprehensive full-stack management suite designed specifically to streamline ministry coordination.

This step-by-step guide will walk you through how to use all the features of the application and what to do if you run into any issues.

---

## 1. Global Navigation & Controls

At the very top of the application, you will see a few permanent controls that affect the entire dashboard:

*   **Year Selector (Top Right):** By default, the application shows data for the current year. Click the dropdown to view past or future years. This filters the events shown across all tabs.
*   **Settings / System Administration (Gear Icon):** Click this to open the admin panel. Here, you can **Reset to Starter Data**, which will wipe all custom changes and restore the original demo events, assets, and volunteers. *Use this with caution!*
*   **Main Navigation Bar:** Below the header, you will find tabs to switch between different modules (Command Overview, Reverse-Timeline, Universal Document Hub, etc.). Click any tab to switch views instantly.

---

## 2. Command Overview

The **Command Overview** is the default landing page. It provides a high-level summary of your selected event.

*   **Selecting an Event:** At the top of the Overview, you will see a dropdown menu. Use this to select which event you want to focus on. The rest of the dashboard (budgets, logistics, timelines) will adapt to the event you select here.
*   **Key Metrics:** View at-a-glance statistics, including budget utilization, total registered volunteers, and completed tasks.
*   **Activity Feed:** Keep an eye on recent updates and system logs in real-time.

---

## 3. Reverse-Timeline

The **Reverse-Timeline** tab is your scheduling engine. It takes your event date and works backward to create chronological milestone blocks (e.g., "6 Months Out," "3 Months Out," "Week Of").

*   **Create a New Event:** Click the **Create Event** button on the left sidebar to add a new event to the calendar. Provide a name, date, and description.
*   **Edit an Event:** Select an event and click **Edit Details** to update its name, date, or description.
*   **Add Tasks to Milestones:** Within each time block (e.g., "1 Month Out"), click **+ Add Task** to assign a specific to-do item.
*   **Complete Tasks:** Simply click the checkbox next to a task to mark it as complete. The progress bar at the top of the timeline will automatically update.

---

## 4. Universal Document Hub

The **Universal Document Hub** (previously Planning Centre) manages all your files, spreadsheets, and event documents. It is divided into two sub-tabs:

### Event Document Hub
*   View all documents currently attached to the active event.
*   **Access Audit:** Click the **Audit** button (shield icon) next to a document to run a manual security check. This ensures the document has the correct public/private sharing permissions.
*   **Webhooks:** Click the **Watch** button (bell icon) to subscribe to real-time push notifications. If someone edits the document in Google Drive, the system will be notified.

### Google Drive Integration
*   **Connect Drive:** Click **Authorize with Google** to sign in securely.
*   **Browse & Attach:** Once logged in, you can browse your Google Drive folders. Click on any Document, Spreadsheet, or PDF to instantly attach it to your event for easy access.

---

## 5. Logistics Manager

The **Logistics Manager** tracks physical assets (like sound equipment, trailers, and tables) to ensure nothing is forgotten on the day of the event.

*   **Asset Catalog:** See all available assets your organization owns. Click **+ New Asset** to add items to your inventory.
*   **Reserve Assets:** Select an event, choose an asset, set a quantity, and click **Reserve**. The item will be locked in for that event.
*   **Export Packing List:** Click **Export List** to download or view a consolidated checklist of everything you need to pack in the trailer for the Day-Of.

---

## 6. Budget Ledger

The **Budget Ledger** tracks all finances for the selected event.

*   **Set Budget Cap:** Click **Edit Cap** to define the total budget allowed for the event.
*   **Log an Expense:** Fill out the expense form (Description, Cost, Category, Purchaser, and Date). You can also drag-and-drop a receipt file directly into the designated drop zone.
*   **Sorting:** Click on any column header (e.g., "Cost" or "Date") in the expense table to sort the list.
*   **Bulk Actions:** Check the boxes next to multiple expenses to delete them all at once or recategorize them in bulk.

---

## 7. Volunteer Registry

The **Volunteer Registry** is where you manage your team.

*   **Add a Volunteer:** Click **+ Add Volunteer** to create a new profile.
*   **Assign Roles:** You can assign volunteers to specific events and designate their roles (e.g., "Setup Crew", "Guest Services").
*   **Contact Info:** Click the **Add Email** button next to a volunteer's name to update their contact details.

---

## 8. Debrief Archive

The **Debrief Archive** stores post-event notes and lessons learned.

*   **Create a Debrief:** After an event concludes, click **New Debrief** to log what went well and what needs improvement.
*   **Edit Records:** You can always return to past debriefs and update the notes for future reference.

---

## 9. Troubleshooting & Error Handling

If you encounter an issue while using the dashboard, don't panic! Here are common scenarios and how to resolve them:

*   **Red Notification Banners:** If an action fails (e.g., saving a task or deleting an expense), a red banner will appear at the top or bottom of the screen with an error message. Wait a few seconds and try clicking the button again.
*   **"No Data" or Missing Events:** If the dashboard looks empty, check the **Year Selector** in the top right corner. You might be viewing a year that has no scheduled events.
*   **Google Drive Won't Connect:** Ensure that your browser is not blocking pop-ups. If the authorization window gets stuck, refresh the page and click **Authorize with Google** again.
*   **"Failed to align planning data" Error:** If you see a network error on the Document Hub, verify your internet connection. If the issue persists, the backend server might be restarting; wait one minute and refresh the page.
*   **Stuck Loading Spinners:** If a button (like "Cloning..." or "Saving...") spins indefinitely, refresh your browser page. Your most recent change may have already been saved.

If you ever get completely stuck or the data looks wrong, you can always click the **Settings (Gear Icon)** and select **Reset to Starter Data** to start fresh with a clean slate.
