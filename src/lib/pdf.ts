import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { WeeklyMenu } from "@/types";
import { aggregateIngredients, CATEGORY_LABELS, CATEGORY_ORDER } from "./aggregateIngredients";
import { dayMacros, fmtMacro, weekMacros } from "./macros";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayLabel(iso: string, i: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `Day ${i + 1}`;
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function ytSearchUrl(name: string, cuisine: string): string {
  const q = cuisine === "indian" ? `${name} recipe hindi` : `${name} recipe`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function downloadMenuPdf(menu: WeeklyMenu, servings: number) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  const isDaily = menu.days.length === 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(isDaily ? "Daily Menu" : "Weekly Menu", margin, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `Generated ${new Date(menu.generatedAt).toLocaleDateString()} · ${servings} servings per dish`,
    margin,
    y,
  );
  doc.setTextColor(0);
  y += 18;

  // Menu table
  autoTable(doc, {
    startY: y,
    head: [["Day", "Breakfast", "Lunch", "Dinner", "Daily totals"]],
    body: menu.days.map((d, i) => {
      const dm = dayMacros(d);
      return [
        dayLabel(d.date, i),
        `${d.breakfast.name}\n${fmtMacro(d.breakfast.macros.protein)}g P · ${fmtMacro(d.breakfast.macros.calories)} kcal`,
        `${d.lunch.name}\n${fmtMacro(d.lunch.macros.protein)}g P · ${fmtMacro(d.lunch.macros.calories)} kcal`,
        `${d.dinner.name}\n${fmtMacro(d.dinner.macros.protein)}g P · ${fmtMacro(d.dinner.macros.calories)} kcal`,
        `${fmtMacro(dm.protein)}g P\n${fmtMacro(dm.carbs)}g C · ${fmtMacro(dm.fat)}g F\n${fmtMacro(dm.calories)} kcal`,
      ];
    }),
    styles: { fontSize: 9, cellPadding: 6, valign: "top", textColor: 30 },
    headStyles: { fillColor: [204, 120, 92], textColor: 255 },
    columnStyles: { 0: { cellWidth: 60 }, 4: { cellWidth: 80 } },
    margin: { left: margin, right: margin },
  });

  const wm = weekMacros(menu);
  // @ts-expect-error - jspdf-autotable adds lastAutoTable on the doc
  y = doc.lastAutoTable.finalY + 16;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${isDaily ? "Daily" : "Weekly"} totals: ${fmtMacro(wm.protein)}g protein · ${fmtMacro(wm.carbs)}g carbs · ${fmtMacro(wm.fat)}g fat · ${fmtMacro(wm.calories)} kcal`,
    margin,
    y,
  );

  // Shopping list
  doc.addPage();
  y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Shopping List", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Quantities scaled to ${servings} servings per dish.`, margin, y + 12);
  doc.setTextColor(0);
  y += 22;

  const agg = aggregateIngredients(menu, servings);
  for (const cat of CATEGORY_ORDER) {
    const items = agg[cat];
    if (!items.length) continue;
    autoTable(doc, {
      startY: y,
      head: [[CATEGORY_LABELS[cat], "Quantity"]],
      body: items.map((it) => [it.name, `${it.quantity} ${it.unit}`]),
      styles: { fontSize: 10, cellPadding: 5 },
      headStyles: { fillColor: [122, 139, 90], textColor: 255 },
      columnStyles: { 1: { cellWidth: 90, halign: "right" } },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 12;
  }

  // Recipe pages
  for (let i = 0; i < menu.days.length; i++) {
    const day = menu.days[i];
    for (const slot of ["breakfast", "lunch", "dinner"] as const) {
      const dish = day[slot];
      doc.addPage();
      let yy = margin;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(dish.name, margin, yy);
      yy += 20;

      // Subline
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `${dayLabel(day.date, i)} · ${slot} · ${dish.cuisine} · ${dish.totalMinutes} min · serves ${dish.servings}`,
        margin,
        yy,
      );
      doc.setTextColor(0);
      yy += 14;

      // Macros row
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${fmtMacro(dish.macros.protein)}g P · ${fmtMacro(dish.macros.carbs)}g C · ${fmtMacro(dish.macros.fat)}g F · ${fmtMacro(dish.macros.calories)} kcal (per serving)`,
        margin,
        yy,
      );
      yy += 12;

      // YouTube hint
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(204, 120, 92);
      doc.textWithLink(`Watch how it's made →`, margin, yy + 8, { url: ytSearchUrl(dish.name, dish.cuisine) });
      doc.setTextColor(0);
      yy += 16;

      // Ingredients
      autoTable(doc, {
        startY: yy,
        head: [["Ingredient", "Amount"]],
        body: dish.ingredients.map((ing) => [ing.name, `${ing.quantity} ${ing.unit}`]),
        styles: { fontSize: 10, cellPadding: 5, valign: "top" },
        headStyles: { fillColor: [60, 60, 60], textColor: 255 },
        columnStyles: { 1: { cellWidth: 80, halign: "right" } },
        margin: { left: margin, right: margin },
      });
      // @ts-expect-error
      yy = doc.lastAutoTable.finalY + 16;

      // Method
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Method", margin, yy);
      yy += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      for (let s = 0; s < dish.recipe.length; s++) {
        const text = `${s + 1}.  ${dish.recipe[s]}`;
        const lines = doc.splitTextToSize(text, pageW - margin * 2);
        const blockH = lines.length * 14 + 6;
        if (yy + blockH > pageH - margin) {
          doc.addPage();
          yy = margin;
        }
        doc.text(lines, margin, yy + 12);
        yy += blockH;
      }

      // Cook tip
      if (dish.tip) {
        if (yy + 50 > pageH - margin) {
          doc.addPage();
          yy = margin;
        }
        yy += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Cook's tip", margin, yy);
        yy += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(`• ${dish.tip}`, pageW - margin * 2);
        doc.text(lines, margin, yy + 10);
      }
    }
  }

  doc.save(`${isDaily ? "daily" : "weekly"}-menu-${menu.weekStart}.pdf`);
}
