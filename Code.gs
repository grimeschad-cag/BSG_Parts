// BSG Parts Ordering App - Google Apps Script Backend
// This script handles all backend operations for the BSG Parts ordering system

const SS = SpreadsheetApp.getActiveSpreadsheet();
const ORDERS_SHEET = SS.getSheetByName("Orders");
const ORDER_ITEMS_SHEET = SS.getSheetByName("OrderItems");
const TECHNICIANS_SHEET = SS.getSheetByName("Technicians");
const CONFIG_SHEET = SS.getSheetByName("Config");

// ============================================================================
// MAIN ENTRY POINTS
// ============================================================================

function doGet(e) {
  const response = handleRequest(e.parameter);
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

function doPost(e) {
  let params = {};
  if (e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      params = e.parameter;
    }
  } else {
    params = e.parameter;
  }

  const response = handleRequest(params);
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

// ============================================================================
// REQUEST ROUTER
// ============================================================================

function handleRequest(params) {
  try {
    const action = params.action;

    if (!action) {
      return { error: "Missing action parameter" };
    }

    switch (action) {
      // Auth Actions
      case "verifyTechPIN":
        return verifyTechPIN(params.pin);
      case "verifyPartsTeamPIN":
        return verifyPartsTeamPIN(params.pin);
      case "verifyAdminPIN":
        return verifyAdminPIN(params.pin);

      // Order Actions
      case "placeOrder":
        return placeOrder(params);
      case "getOrdersByTech":
        return getOrdersByTech(params.pin);
      case "getAllOrders":
        return getAllOrders(params);
      case "updateOrderItems":
        return updateOrderItems(params.orderId, params.items);

      // Admin Actions
      case "getTechnicians":
        return getTechnicians();
      case "addTechnician":
        return addTechnician(params);
      case "updateTechnician":
        return updateTechnician(params);
      case "deleteTechnician":
        return deleteTechnician(params.pin);
      case "getConfig":
        return getConfig();
      case "updateConfig":
        return updateConfig(params);

      // Report Actions
      case "getFilledReport":
        return getFilledReport(params.startDate, params.endDate);
      case "getBackorderReport":
        return getBackorderReport();

      default:
        return { error: "Unknown action: " + action };
    }
  } catch (error) {
    return { error: error.toString(), details: error.stack };
  }
}

// ============================================================================
// AUTH ACTIONS
// ============================================================================

function verifyTechPIN(pin) {
  const data = getTechniciansData();
  const tech = data.find(t => t.PIN === pin && t.Active === TRUE);

  if (!tech) {
    return { success: false, error: "Invalid PIN" };
  }

  return {
    success: true,
    name: tech.Name,
    email: tech.Email,
    pin: tech.PIN
  };
}

function verifyPartsTeamPIN(pin) {
  const config = getConfigMap();
  if (config.PartsTeamPIN === pin) {
    return { success: true };
  }
  return { success: false, error: "Invalid PIN" };
}

function verifyAdminPIN(pin) {
  const config = getConfigMap();
  if (config.AdminPIN === pin) {
    return { success: true };
  }
  return { success: false, error: "Invalid PIN" };
}

// ============================================================================
// ORDER ACTIONS
// ============================================================================

function placeOrder(params) {
  const {
    techPin,
    account,
    urgency,
    notes,
    items // array of {itemNumber, itemDescription, vendorName, vendorItemNum, uom, qtyOrdered}
  } = params;

  // Verify tech exists
  const techVerify = verifyTechPIN(techPin);
  if (!techVerify.success) {
    return { success: false, error: "Invalid tech PIN" };
  }

  // Generate OrderID
  const orderId = generateOrderID();
  const today = new Date();

  // Get tech info
  const techData = getTechniciansData().find(t => t.PIN === techPin);

  // Add to Orders sheet
  const ordersData = [
    orderId,
    techData.Name,
    techData.Email,
    techPin,
    account,
    urgency,
    notes,
    today.toISOString().split('T')[0],
    "Open"
  ];

  ORDERS_SHEET.appendRow(ordersData);

  // Add to OrderItems sheet
  if (items && items.length > 0) {
    for (let item of items) {
      const orderItemData = [
        orderId,
        item.itemNumber,
        item.itemDescription,
        item.vendorName,
        item.vendorItemNum,
        item.uom,
        item.qtyOrdered,
        0, // QtyFilled
        0, // QtyBackordered
        "Pending",
        "", // FillDate
        "" // FillNotes
      ];
      ORDER_ITEMS_SHEET.appendRow(orderItemData);
    }
  }

  // Send email to Parts Team
  const config = getConfigMap();
  const itemsDetail = items.map(i =>
    `- ${i.itemNumber}: ${i.itemDescription} (${i.qtyOrdered} ${i.uom})`
  ).join("\n");

  const emailSubject = `New Order: ${orderId} from ${techData.Name}`;
  const emailBody = `A new order has been placed:

Order ID: ${orderId}
Tech Name: ${techData.Name}
Tech Email: ${techData.Email}
Account: ${account}
Urgency: ${urgency}
Date: ${today.toISOString().split('T')[0]}
Notes: ${notes || 'None'}

Items:
${itemsDetail}`;

  MailApp.sendEmail(config.PartsTeamEmail, emailSubject, emailBody);

  return {
    success: true,
    orderId: orderId,
    message: "Order placed successfully"
  };
}

function getOrdersByTech(pin) {
  const techVerify = verifyTechPIN(pin);
  if (!techVerify.success) {
    return { success: false, error: "Invalid PIN" };
  }

  const ordersData = getOrdersData();
  const itemsData = getOrderItemsData();

  const techOrders = ordersData.filter(o => o.TechPIN === pin);
  const result = techOrders.map(order => {
    const items = itemsData.filter(i => i.OrderID === order.OrderID);
    return {
      ...order,
      items: items
    };
  });

  return {
    success: true,
    orders: result
  };
}

function getAllOrders(params) {
  const {
    status,
    tech,
    startDate,
    endDate,
    urgency
  } = params;

  let ordersData = getOrdersData();
  let itemsData = getOrderItemsData();

  // Apply filters
  if (status) {
    ordersData = ordersData.filter(o => o.Status === status);
  }
  if (tech) {
    ordersData = ordersData.filter(o => o.TechName.toLowerCase().includes(tech.toLowerCase()));
  }
  if (urgency) {
    ordersData = ordersData.filter(o => o.Urgency === urgency);
  }
  if (startDate) {
    const start = new Date(startDate);
    ordersData = ordersData.filter(o => new Date(o.OrderDate) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    ordersData = ordersData.filter(o => new Date(o.OrderDate) <= end);
  }

  // Attach items to each order
  const result = ordersData.map(order => {
    const items = itemsData.filter(i => i.OrderID === order.OrderID);
    return {
      ...order,
      items: items
    };
  });

  return {
    success: true,
    orders: result,
    count: result.length
  };
}

function updateOrderItems(orderId, items) {
  const itemsData = getOrderItemsData();
  const itemsSheet = ORDER_ITEMS_SHEET;

  // Get all rows in OrderItems sheet
  const allRows = itemsSheet.getDataRange().getValues();
  const headers = allRows[0];

  // Find column indices
  const colIndex = {
    OrderID: headers.indexOf("OrderID"),
    ItemNumber: headers.indexOf("ItemNumber"),
    QtyFilled: headers.indexOf("QtyFilled"),
    QtyBackordered: headers.indexOf("QtyBackordered"),
    LineStatus: headers.indexOf("LineStatus"),
    FillDate: headers.indexOf("FillDate"),
    FillNotes: headers.indexOf("FillNotes")
  };

  // Update items
  let updatedCount = 0;
  for (let update of items) {
    for (let i = 1; i < allRows.length; i++) {
      if (allRows[i][colIndex.OrderID] === orderId &&
          allRows[i][colIndex.ItemNumber] === update.itemNumber) {

        if (update.qtyFilled !== undefined) {
          itemsSheet.getRange(i + 1, colIndex.QtyFilled + 1).setValue(update.qtyFilled);
        }
        if (update.qtyBackordered !== undefined) {
          itemsSheet.getRange(i + 1, colIndex.QtyBackordered + 1).setValue(update.qtyBackordered);
        }
        if (update.lineStatus) {
          itemsSheet.getRange(i + 1, colIndex.LineStatus + 1).setValue(update.lineStatus);
        }
        if (update.fillNotes) {
          itemsSheet.getRange(i + 1, colIndex.FillNotes + 1).setValue(update.fillNotes);
        }
        if (update.fillDate) {
          itemsSheet.getRange(i + 1, colIndex.FillDate + 1).setValue(update.fillDate);
        } else if (update.qtyFilled && update.qtyFilled > 0) {
          itemsSheet.getRange(i + 1, colIndex.FillDate + 1).setValue(new Date().toISOString().split('T')[0]);
        }

        updatedCount++;
      }
    }
  }

  // Recalculate order status
  updateOrderStatus(orderId);

  // Get tech email and send notification
  const order = getOrdersData().find(o => o.OrderID === orderId);
  if (order && order.TechEmail) {
    sendFulfillmentEmail(orderId, order.TechEmail);
  }

  return {
    success: true,
    message: `Updated ${updatedCount} items`,
    orderId: orderId
  };
}

// ============================================================================
// ADMIN ACTIONS
// ============================================================================

function getTechnicians() {
  const data = getTechniciansData();
  return {
    success: true,
    technicians: data
  };
}

function addTechnician(params) {
  const { name, pin, email } = params;

  if (!name || !pin || !email) {
    return { success: false, error: "Missing required fields: name, pin, email" };
  }

  const row = [name, pin, email, TRUE];
  TECHNICIANS_SHEET.appendRow(row);

  return {
    success: true,
    message: "Technician added successfully"
  };
}

function updateTechnician(params) {
  const { pin, name, email, active } = params;

  const data = getTechniciansData();
  const allRows = TECHNICIANS_SHEET.getDataRange().getValues();
  const headers = allRows[0];

  const colIndex = {
    PIN: headers.indexOf("PIN"),
    Name: headers.indexOf("Name"),
    Email: headers.indexOf("Email"),
    Active: headers.indexOf("Active")
  };

  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][colIndex.PIN] === pin) {
      if (name) TECHNICIANS_SHEET.getRange(i + 1, colIndex.Name + 1).setValue(name);
      if (email) TECHNICIANS_SHEET.getRange(i + 1, colIndex.Email + 1).setValue(email);
      if (active !== undefined) TECHNICIANS_SHEET.getRange(i + 1, colIndex.Active + 1).setValue(active);

      return { success: true, message: "Technician updated successfully" };
    }
  }

  return { success: false, error: "Technician not found" };
}

function deleteTechnician(pin) {
  return updateTechnician({ pin: pin, active: FALSE });
}

function getConfig() {
  const config = getConfigMap();
  return {
    success: true,
    config: config
  };
}

function updateConfig(params) {
  const { key, value } = params;

  if (!key || value === undefined) {
    return { success: false, error: "Missing key or value" };
  }

  const data = getConfigData();
  const allRows = CONFIG_SHEET.getDataRange().getValues();
  const headers = allRows[0];

  const colIndex = {
    Key: headers.indexOf("Key"),
    Value: headers.indexOf("Value")
  };

  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][colIndex.Key] === key) {
      CONFIG_SHEET.getRange(i + 1, colIndex.Value + 1).setValue(value);
      return { success: true, message: "Config updated successfully" };
    }
  }

  // If key doesn't exist, add it
  CONFIG_SHEET.appendRow([key, value]);
  return { success: true, message: "Config added successfully" };
}

// ============================================================================
// REPORT ACTIONS
// ============================================================================

function getFilledReport(startDate, endDate) {
  let itemsData = getOrderItemsData();

  const start = new Date(startDate);
  const end = new Date(endDate);

  const filledItems = itemsData.filter(item => {
    if (!item.FillDate) return false;
    const fillDate = new Date(item.FillDate);
    return fillDate >= start && fillDate <= end && item.LineStatus === "Filled";
  });

  return {
    success: true,
    filledItems: filledItems,
    count: filledItems.length
  };
}

function getBackorderReport() {
  const itemsData = getOrderItemsData();
  const backorders = itemsData.filter(item =>
    item.QtyBackordered > 0 || item.LineStatus === "Backordered"
  );

  return {
    success: true,
    backorders: backorders,
    count: backorders.length
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateOrderID() {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PO-${year}${month}${day}-${random}`;
}

function updateOrderStatus(orderId) {
  const itemsData = getOrderItemsData();
  const items = itemsData.filter(i => i.OrderID === orderId);

  if (items.length === 0) return;

  let status = "Open";
  const filledCount = items.filter(i => i.LineStatus === "Filled").length;
  const totalCount = items.length;

  if (filledCount === totalCount) {
    status = "Filled";
  } else if (filledCount > 0) {
    status = "Partial";
  } else {
    const backorderedCount = items.filter(i => i.LineStatus === "Backordered").length;
    if (backorderedCount === totalCount) {
      status = "Backordered";
    }
  }

  // Update Orders sheet
  const ordersData = getOrdersData();
  const allRows = ORDERS_SHEET.getDataRange().getValues();
  const headers = allRows[0];
  const statusColIndex = headers.indexOf("Status");

  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][headers.indexOf("OrderID")] === orderId) {
      ORDERS_SHEET.getRange(i + 1, statusColIndex + 1).setValue(status);
      break;
    }
  }
}

function sendFulfillmentEmail(orderId, techEmail) {
  const itemsData = getOrderItemsData();
  const items = itemsData.filter(i => i.OrderID === orderId);

  const filledItems = items.filter(i => i.QtyFilled > 0);
  const backorderedItems = items.filter(i => i.QtyBackordered > 0);

  let emailBody = `Order ${orderId} has been updated:\n\n`;

  if (filledItems.length > 0) {
    emailBody += "FILLED ITEMS:\n";
    for (let item of filledItems) {
      emailBody += `- ${item.ItemNumber}: ${item.ItemDescription}\n`;
      emailBody += `  Qty Filled: ${item.QtyFilled} ${item.UOM}\n`;
      if (item.FillNotes) {
        emailBody += `  Notes: ${item.FillNotes}\n`;
      }
    }
    emailBody += "\n";
  }

  if (backorderedItems.length > 0) {
    emailBody += "BACKORDERED ITEMS:\n";
    for (let item of backorderedItems) {
      emailBody += `- ${item.ItemNumber}: ${item.ItemDescription}\n`;
      emailBody += `  Qty Backordered: ${item.QtyBackordered} ${item.UOM}\n`;
      if (item.FillNotes) {
        emailBody += `  Notes: ${item.FillNotes}\n`;
      }
    }
  }

  MailApp.sendEmail(techEmail, `Order ${orderId} Update`, emailBody);
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

function getOrdersData() {
  const sheet = ORDERS_SHEET;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  return data.slice(1).map(row => ({
    OrderID: row[headers.indexOf("OrderID")],
    TechName: row[headers.indexOf("TechName")],
    TechEmail: row[headers.indexOf("TechEmail")],
    TechPIN: row[headers.indexOf("TechPIN")],
    Account: row[headers.indexOf("Account")],
    Urgency: row[headers.indexOf("Urgency")],
    Notes: row[headers.indexOf("Notes")],
    OrderDate: row[headers.indexOf("OrderDate")],
    Status: row[headers.indexOf("Status")]
  }));
}

function getOrderItemsData() {
  const sheet = ORDER_ITEMS_SHEET;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  return data.slice(1).map(row => ({
    OrderID: row[headers.indexOf("OrderID")],
    ItemNumber: row[headers.indexOf("ItemNumber")],
    ItemDescription: row[headers.indexOf("ItemDescription")],
    VendorName: row[headers.indexOf("VendorName")],
    VendorItemNum: row[headers.indexOf("VendorItemNum")],
    UOM: row[headers.indexOf("UOM")],
    QtyOrdered: row[headers.indexOf("QtyOrdered")],
    QtyFilled: row[headers.indexOf("QtyFilled")],
    QtyBackordered: row[headers.indexOf("QtyBackordered")],
    LineStatus: row[headers.indexOf("LineStatus")],
    FillDate: row[headers.indexOf("FillDate")],
    FillNotes: row[headers.indexOf("FillNotes")]
  }));
}

function getTechniciansData() {
  const sheet = TECHNICIANS_SHEET;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  return data.slice(1).map(row => ({
    Name: row[headers.indexOf("Name")],
    PIN: row[headers.indexOf("PIN")],
    Email: row[headers.indexOf("Email")],
    Active: row[headers.indexOf("Active")]
  }));
}

function getConfigData() {
  const sheet = CONFIG_SHEET;
  const data = sheet.getDataRange().getValues();
  return data.slice(1);
}

function getConfigMap() {
  const sheet = CONFIG_SHEET;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const result = {};

  for (let i = 1; i < data.length; i++) {
    const key = data[i][headers.indexOf("Key")];
    const value = data[i][headers.indexOf("Value")];
    result[key] = value;
  }

  return result;
}
