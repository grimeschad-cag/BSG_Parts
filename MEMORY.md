# BSG Parts App — Project Memory

## Project Overview
A parts ordering app for BSG (Beverage Service Group) technicians and parts team.
- **Repo**: github.com/grimeschad-cag/BSG_Parts
- **Live URL**: grimeschad-cag.github.io/BSG_Parts
- **GitHub Token**: (stored locally — never commit to repo)
- **Owner**: grimeschad-cag / grimeschad@gmail.com

## Architecture
- **Frontend**: Static HTML/CSS/JS hosted on GitHub Pages
- **Backend**: Google Sheets + Google Apps Script (web app)
- **Email**: Google Apps Script (sends via Gmail)
- **Parts Catalog**: `parts_data.js` file (~5,933 items loaded client-side)

## Files in Repo
| File | Purpose |
|------|---------|
| `index.html` | Tech ordering page — mobile-first, PIN login |
| `fulfillment.html` | Parts Team dashboard — filterable, fulfillment workflow |
| `uploader.html` | Admin panel + GitHub file uploader/deployer |
| `parts_data.js` | Parts catalog as JS array (from Final_Cleaned_Items.csv) |
| `bsg_logo.png` | BSG circular logo (black & white) |
| `MEMORY.md` | This file — project tracker |

## Google Sheet Structure
- **Sheet: "Orders"** — OrderID, TechName, TechEmail, TechPIN, Account, Urgency, Notes, OrderDate, Status (Pending/Partial/Filled/Cancelled)
- **Sheet: "OrderItems"** — OrderID, ItemNumber, ItemDescription, VendorName, VendorItemNum, UOM, QtyOrdered, QtyFilled, QtyBackordered, LineStatus, FillDate, FillNotes
- **Sheet: "Technicians"** — Name, PIN, Email, Active (TRUE/FALSE)
- **Sheet: "Config"** — Key/Value pairs: PartsTeamPIN, PartsTeamEmail, AdminPIN

## App Design Decisions
1. **Three separate pages** — Techs, Parts Team, and Admin/Uploader each have their own URL
2. **Tech Login**: Each tech has a unique PIN → auto-fills name/email
3. **Parts Team Login**: Separate PIN on fulfillment.html
4. **Admin**: Built into uploader.html with its own PIN
5. **Order Fields**: Parts + quantities, Account/Location, Urgency (Normal/Rush), Notes
6. **Fulfillment**: Line-item + quantity level (ordered 10, filled 6, backordered 4)
7. **Notifications**: Email both ways via Apps Script (new order → Parts Team, filled → Tech)
8. **Tech Tracking**: Full order history with status visible to each tech
9. **Reports**: Download filled items and backorders as Excel (.xlsx) for date range
10. **Catalog Display**: Item Number, Item Description, Vendor Name, Vendor Item Number, Base U Of M
    - EXCLUDED from order page: Super Group, Vendor Item Description, Vendor ID
11. **Design**: Black & white theme, BSG logo, mobile-first for tech ordering
12. **Deploy Method**: Browser file picker uploader (same as BSG Quote Builder)

## Google Apps Script Setup (User Must Do)
1. Create a new blank Google Sheet
2. Open Extensions > Apps Script
3. Paste the Code.gs content
4. Select `setupSheet` from the function dropdown, click Run ▶ (authorize when prompted)
   - This auto-creates all 4 sheets with headers, formatting, and default PINs
   - Default PINs: Tech test=0000, Parts Team=1234, Admin=9999
5. Deploy > New deployment > Web app (Execute as: Me, Access: Anyone)
6. Copy the web app URL into each HTML file's `API_URL` constant

## Important Notes
- GitHub token is NOT stored in uploader.html (GitHub secret scanning blocks it) — admin must paste token at runtime in the Deploy tab
- Code.gs is pushed to the repo for reference but the actual working copy lives in Google Apps Script

## Changelog
- **2026-02-28**: Project created. Initial build of all files.
- **2026-02-28**: Fixed uploader.html — removed hardcoded GitHub token (secret scanning blocked push). Token is now entered at runtime.
- **2026-02-28**: Added `setupSheet()` auto-setup function to Code.gs — creates all sheets, headers, formatting, and default PINs with one click.
