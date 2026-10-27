import PDFDocument from "pdfkit";

// ---- Branding ----
const BRANDING = {
  bankName: "SecureBank",
  tagline: "Banking Made Simple, Secure & Smart",
  address: "123 Financial District, New York, NY 10001",
  phone: "+1 (800) 555-BANK",
  email: "support@securebank.com",
  website: "www.securebank.com",
  primaryColor: "#2563eb",
  darkColor: "#1e293b",
  lightColor: "#f1f5f9",
  successColor: "#22c55e",
  dangerColor: "#ef4444",
  grayColor: "#64748b",
  routingNumber: "021000021",
  swiftCode: "SECBUSA33XXX",
  fdicNotice:
    "Member FDIC. Equal Housing Lender. Deposits are insured up to $250,000.",
};

const formatCurrencyPDF = (amount, currency = "USD") => {
  const n = Number(amount || 0);
  return `${currency} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDatePDF = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatDateTimePDF = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const drawHeader = (doc, title) => {
  const pageWidth = doc.page.width;
  const margin = 50;

  doc.rect(0, 0, pageWidth, 100).fill(BRANDING.primaryColor);

  doc
    .fillColor("#ffffff")
    .fontSize(24)
    .font("Helvetica-Bold")
    .text(BRANDING.bankName, margin, 30);

  doc
    .fillColor("#dbeafe")
    .fontSize(9)
    .font("Helvetica")
    .text(BRANDING.tagline, margin, 60);

  doc
    .fillColor("#ffffff")
    .fontSize(8)
    .text(BRANDING.phone, pageWidth - margin - 200, 35, {
      width: 200,
      align: "right",
    })
    .text(BRANDING.email, pageWidth - margin - 200, 47, {
      width: 200,
      align: "right",
    })
    .text(BRANDING.website, pageWidth - margin - 200, 59, {
      width: 200,
      align: "right",
    });

  doc
    .fillColor(BRANDING.darkColor)
    .fontSize(18)
    .font("Helvetica-Bold")
    .text(title, margin, 120);

  doc.moveDown(0.5);
  return 150;
};

const drawSection = (doc, { x, y, width, title, rows }) => {
  const padding = 12;
  const rowHeight = 18;
  const headerHeight = title ? 24 : 0;
  const height = headerHeight + rows.length * rowHeight + padding * 2;

  doc.rect(x, y, width, height).fillAndStroke(BRANDING.lightColor, "#e2e8f0");

  if (title) {
    doc
      .fillColor(BRANDING.primaryColor)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(title.toUpperCase(), x + padding, y + padding, {
        width: width - padding * 2,
      });
  }

  let currentY = y + padding + headerHeight;
  rows.forEach((row) => {
    doc
      .fillColor(BRANDING.grayColor)
      .fontSize(9)
      .font("Helvetica")
      .text(row.label, x + padding, currentY, {
        width: (width - padding * 2) * 0.45,
      });

    doc
      .fillColor(BRANDING.darkColor)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(
        String(row.value ?? "N/A"),
        x + padding + (width - padding * 2) * 0.45,
        currentY,
        { width: (width - padding * 2) * 0.55, align: "right" },
      );

    currentY += rowHeight;
  });

  return height;
};

const drawTransactionTable = (doc, transactions, startY) => {
  const margin = 50;
  const pageWidth = doc.page.width;
  const tableWidth = pageWidth - margin * 2;

  const columns = [
    { key: "date", label: "Date", width: tableWidth * 0.13 },
    { key: "reference", label: "Reference", width: tableWidth * 0.17 },
    { key: "description", label: "Description", width: tableWidth * 0.3 },
    { key: "type", label: "Type", width: tableWidth * 0.12 },
    {
      key: "amount",
      label: "Amount",
      width: tableWidth * 0.14,
      align: "right",
    },
    {
      key: "balance",
      label: "Balance",
      width: tableWidth * 0.14,
      align: "right",
    },
  ];

  const rowHeight = 22;
  const headerHeight = 26;
  let currentY = startY;

  doc.rect(margin, currentY, tableWidth, headerHeight).fill(BRANDING.darkColor);
  let xPos = margin;
  doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
  columns.forEach((col) => {
    doc.text(col.label, xPos + 6, currentY + 8, {
      width: col.width - 12,
      align: col.align || "left",
    });
    xPos += col.width;
  });
  currentY += headerHeight;

  doc.font("Helvetica").fontSize(8);
  let pageNumber = 1;
  let totalCredits = 0;
  let totalDebits = 0;

  transactions.forEach((txn, index) => {
    if (currentY + rowHeight > doc.page.height - 100) {
      doc.addPage({ margin: 50 });
      pageNumber++;
      currentY = drawHeader(
        doc,
        `Account Statement (Continued - Page ${pageNumber})`,
      );
      doc
        .rect(margin, currentY, tableWidth, headerHeight)
        .fill(BRANDING.darkColor);
      let xh = margin;
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
      columns.forEach((col) => {
        doc.text(col.label, xh + 6, currentY + 8, {
          width: col.width - 12,
          align: col.align || "left",
        });
        xh += col.width;
      });
      currentY += headerHeight;
      doc.font("Helvetica").fontSize(8);
    }

    if (index % 2 === 0) {
      doc.rect(margin, currentY, tableWidth, rowHeight).fill("#f8fafc");
    }

    const amountVal = Number(txn.amount || 0);
    const isCredit = txn.type === "credit";
    if (isCredit) totalCredits += amountVal;
    else totalDebits += amountVal;

    const rowValues = {
      date: formatDatePDF(txn.date),
      reference: txn.referenceNumber || txn.transactionId || "-",
      description: txn.description || "-",
      type: isCredit ? "Credit" : "Debit",
      amount: `${isCredit ? "+" : "-"} ${formatCurrencyPDF(amountVal)}`,
      balance: txn.balance != null ? formatCurrencyPDF(txn.balance) : "-",
    };

    let xCell = margin;
    columns.forEach((col) => {
      const cellValue = rowValues[col.key] ?? "";
      let textColor = BRANDING.darkColor;
      if (col.key === "amount") {
        textColor = isCredit ? BRANDING.successColor : BRANDING.dangerColor;
      }
      doc
        .fillColor(textColor)
        .font(col.key === "amount" ? "Helvetica-Bold" : "Helvetica")
        .text(String(cellValue), xCell + 6, currentY + 6, {
          width: col.width - 12,
          align: col.align || "left",
          ellipsis: true,
          height: rowHeight - 6,
        });
      xCell += col.width;
    });

    doc
      .moveTo(margin, currentY + rowHeight)
      .lineTo(margin + tableWidth, currentY + rowHeight)
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .stroke();

    currentY += rowHeight;
  });

  return { y: currentY, totalCredits, totalDebits };
};

const drawSummary = (
  doc,
  {
    startY,
    openingBalance,
    closingBalance,
    totalCredits,
    totalDebits,
    transactionCount,
    currency,
  },
) => {
  const margin = 50;
  const pageWidth = doc.page.width;
  const width = pageWidth - margin * 2;
  const currentY = startY + 20;

  if (currentY + 150 > doc.page.height - 80) {
    doc.addPage({ margin: 50 });
    const newY = drawHeader(doc, "Statement Summary");
    return drawSummary(doc, {
      startY: newY,
      openingBalance,
      closingBalance,
      totalCredits,
      totalDebits,
      transactionCount,
      currency,
    });
  }

  doc.rect(margin, currentY, width, 130).fillAndStroke("#ffffff", "#e2e8f0");

  doc
    .fillColor(BRANDING.darkColor)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Statement Summary", margin + 15, currentY + 15);

  const leftX = margin + 15;
  const rightX = margin + width / 2 + 10;
  let leftY = currentY + 40;
  const lineHeight = 18;

  const leftStats = [
    ["Opening Balance", formatCurrencyPDF(openingBalance, currency)],
    ["Closing Balance", formatCurrencyPDF(closingBalance, currency)],
    ["Total Credits", `+ ${formatCurrencyPDF(totalCredits, currency)}`],
    ["Total Debits", `- ${formatCurrencyPDF(totalDebits, currency)}`],
    ["Transactions", `${transactionCount}`],
  ];

  leftStats.forEach(([label, value]) => {
    doc
      .fillColor(BRANDING.grayColor)
      .fontSize(9)
      .font("Helvetica")
      .text(label, leftX, leftY, { width: 120 });

    const isCredit = label === "Total Credits";
    const isDebit = label === "Total Debits";
    const isClosing = label === "Closing Balance";

    doc
      .fillColor(
        isCredit
          ? BRANDING.successColor
          : isDebit
            ? BRANDING.dangerColor
            : isClosing
              ? BRANDING.primaryColor
              : BRANDING.darkColor,
      )
      .font("Helvetica-Bold")
      .fontSize(isClosing ? 10 : 9)
      .text(value, leftX + 130, leftY, { width: 120, align: "right" });

    leftY += lineHeight;
  });

  doc
    .fillColor(BRANDING.grayColor)
    .fontSize(8)
    .font("Helvetica")
    .text("Bank Details", rightX, currentY + 40);

  const bankDetails = [
    `Name: ${BRANDING.bankName}`,
    `Address: ${BRANDING.address}`,
    `Routing: ${BRANDING.routingNumber}`,
    `SWIFT: ${BRANDING.swiftCode}`,
    `Phone: ${BRANDING.phone}`,
  ];

  let rightY = currentY + 55;
  bankDetails.forEach((line) => {
    doc
      .fillColor(BRANDING.darkColor)
      .fontSize(8)
      .font("Helvetica")
      .text(line, rightX, rightY, { width: width / 2 - 25 });
    rightY += 12;
  });

  return currentY + 150;
};

const drawFooters = (doc, accountNumber) => {
  const range = doc.bufferedPageRange();
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);

    doc
      .moveTo(50, pageHeight - 60)
      .lineTo(pageWidth - 50, pageHeight - 60)
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .stroke();

    doc
      .fillColor(BRANDING.grayColor)
      .fontSize(7)
      .font("Helvetica")
      .text(BRANDING.fdicNotice, 50, pageHeight - 50, {
        width: pageWidth - 100,
        align: "center",
      });

    doc
      .fontSize(7)
      .text(
        `Page ${i + 1} of ${range.count}  |  Generated: ${formatDateTimePDF(
          new Date(),
        )}  |  Acct: ****${String(accountNumber || "").slice(-4)}`,
        50,
        pageHeight - 35,
        { width: pageWidth - 100, align: "center" },
      );
  }
};

/**
 * Generate account statement PDF
 * @param {Object} data - { account, period, openingBalance, closingBalance, transactions, summary }
 * @returns {Promise<Buffer>}
 */
export const generateStatementPDF = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const {
        account,
        period,
        openingBalance,
        closingBalance,
        transactions,
        summary,
      } = data;

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 80, left: 50, right: 50 },
        bufferPages: true,
        info: {
          Title: `Account Statement - ${account.accountNumber}`,
          Author: BRANDING.bankName,
          Subject: "Account Statement",
          Keywords: "banking, statement, account",
          Creator: `${BRANDING.bankName} Banking System`,
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      let y = drawHeader(doc, "Account Statement");

      const sectionWidth = (doc.page.width - 100 - 15) / 2;
      drawSection(doc, {
        x: 50,
        y,
        width: sectionWidth,
        title: "Account Holder",
        rows: [
          { label: "Name", value: account.accountHolder || "N/A" },
          { label: "Account Number", value: account.accountNumber },
          { label: "Account Type", value: account.accountType },
          { label: "Currency", value: account.currency },
        ],
      });

      drawSection(doc, {
        x: 50 + sectionWidth + 15,
        y,
        width: sectionWidth,
        title: "Statement Period",
        rows: [
          {
            label: "From",
            value: period.from ? formatDatePDF(period.from) : "Beginning",
          },
          {
            label: "To",
            value: period.to
              ? formatDatePDF(period.to)
              : formatDatePDF(new Date()),
          },
          { label: "Generated", value: formatDatePDF(new Date()) },
          { label: "Records", value: String(summary.totalTransactions || 0) },
        ],
      });

      y += 145;

      doc
        .fillColor(BRANDING.darkColor)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Transaction History", 50, y);

      y += 20;

      if (!transactions || transactions.length === 0) {
        doc
          .fillColor(BRANDING.grayColor)
          .fontSize(10)
          .font("Helvetica-Oblique")
          .text("No transactions found for the selected period.", 50, y, {
            width: doc.page.width - 100,
            align: "center",
          });
        y += 40;
      } else {
        const tableResult = drawTransactionTable(doc, transactions, y);
        y = tableResult.y;

        y = drawSummary(doc, {
          startY: y,
          openingBalance,
          closingBalance,
          totalCredits: tableResult.totalCredits,
          totalDebits: tableResult.totalDebits,
          transactionCount: transactions.length,
          currency: account.currency,
        });
      }

      drawFooters(doc, account.accountNumber);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate loan statement PDF
 * @param {Object} loan - Loan document
 * @param {Array} schedule - EMI schedule
 * @param {Object} user - Loan applicant
 * @returns {Promise<Buffer>}
 */
export const generateLoanStatementPDF = (loan, schedule, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 80, left: 50, right: 50 },
        bufferPages: true,
        info: {
          Title: `Loan Statement - ${loan.loanNumber}`,
          Author: BRANDING.bankName,
        },
      });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const y = drawHeader(doc, "Loan Statement");

      const sectionWidth = (doc.page.width - 100 - 15) / 2;

      drawSection(doc, {
        x: 50,
        y,
        width: sectionWidth,
        title: "Borrower",
        rows: [
          { label: "Name", value: `${user.firstName} ${user.lastName}` },
          { label: "Email", value: user.email },
          { label: "Phone", value: user.phone || "N/A" },
          { label: "Loan Number", value: loan.loanNumber },
        ],
      });

      drawSection(doc, {
        x: 50 + sectionWidth + 15,
        y,
        width: sectionWidth,
        title: "Loan Details",
        rows: [
          { label: "Type", value: loan.loanType },
          { label: "Amount", value: formatCurrencyPDF(loan.amount) },
          { label: "Interest Rate", value: `${loan.interestRate}%` },
          { label: "Term", value: `${loan.termMonths} months` },
          { label: "EMI", value: formatCurrencyPDF(loan.emiAmount) },
          { label: "Status", value: loan.status },
        ],
      });

      let currentY = y + 175;

      doc
        .fillColor(BRANDING.darkColor)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("EMI Schedule", 50, currentY);

      currentY += 25;

      const tableWidth = doc.page.width - 100;
      const columns = [
        { key: "no", label: "#", width: tableWidth * 0.08 },
        { key: "date", label: "Due Date", width: tableWidth * 0.18 },
        { key: "emi", label: "EMI", width: tableWidth * 0.18, align: "right" },
        {
          key: "principal",
          label: "Principal",
          width: tableWidth * 0.18,
          align: "right",
        },
        {
          key: "interest",
          label: "Interest",
          width: tableWidth * 0.18,
          align: "right",
        },
        {
          key: "balance",
          label: "Balance",
          width: tableWidth * 0.2,
          align: "right",
        },
      ];

      doc.rect(50, currentY, tableWidth, 24).fill(BRANDING.darkColor);
      let xPos = 50;
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
      columns.forEach((col) => {
        doc.text(col.label, xPos + 6, currentY + 8, {
          width: col.width - 12,
          align: col.align || "left",
        });
        xPos += col.width;
      });
      currentY += 24;

      doc.font("Helvetica").fontSize(8);

      schedule.forEach((emi, i) => {
        if (currentY + 20 > doc.page.height - 100) {
          doc.addPage({ margin: 50 });
          currentY = 50;
        }

        if (i % 2 === 0) {
          doc.rect(50, currentY, tableWidth, 20).fill("#f8fafc");
        }

        const vals = {
          no: emi.installmentNumber,
          date: formatDatePDF(emi.dueDate),
          emi: formatCurrencyPDF(emi.emiAmount),
          principal: formatCurrencyPDF(emi.principalComponent),
          interest: formatCurrencyPDF(emi.interestComponent),
          balance: formatCurrencyPDF(emi.remainingPrincipal),
        };

        let xc = 50;
        columns.forEach((col) => {
          doc
            .fillColor(BRANDING.darkColor)
            .text(String(vals[col.key]), xc + 6, currentY + 6, {
              width: col.width - 12,
              align: col.align || "left",
              ellipsis: true,
            });
          xc += col.width;
        });

        doc
          .moveTo(50, currentY + 20)
          .lineTo(50 + tableWidth, currentY + 20)
          .strokeColor("#e2e8f0")
          .lineWidth(0.5)
          .stroke();

        currentY += 20;
      });

      drawFooters(doc, loan.loanNumber);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default { generateStatementPDF, generateLoanStatementPDF };
