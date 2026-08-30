import { useEffect, useMemo } from "react";
import { WizardFormData } from "../components/sales/wizardData";

export interface SaleCalculationsResult {
  calcSupplierCost: number;
  calcTa: number;
  calcTotal: number;
  totalItemsCount: number;
}

export function useSaleCalculations(
  form: WizardFormData,
  setForm: React.Dispatch<React.SetStateAction<WizardFormData>>
): SaleCalculationsResult {
  // Memoized computation of total costs across all product arrays
  const totals = useMemo(() => {
    let calcSupplierCost = 0;
    let calcTa = 0;
    let totalItemsCount = 0;

    const addProductTotals = (items?: any[]) => {
      if (!items || !Array.isArray(items)) return;
      totalItemsCount += items.length;
      items.forEach((item) => {
        calcSupplierCost += Number(item.supplierCost) || 0;
        calcTa += Number(item.ta) || 0;
      });
    };

    addProductTotals(form.tickets);
    addProductTotals(form.hotels);
    addProductTotals(form.insurances);
    addProductTotals(form.plans);
    addProductTotals(form.checkIns);
    addProductTotals(form.migrations);
    addProductTotals(form.simCards);
    addProductTotals(form.carRentals);
    addProductTotals(form.fincas);
    addProductTotals(form.tours);
    addProductTotals(form.conventions);
    addProductTotals(form.restaurants);
    addProductTotals(form.visas);
    addProductTotals(form.passports);
    addProductTotals(form.petServices);

    const calcTotal = calcSupplierCost + calcTa;

    return {
      calcSupplierCost,
      calcTa,
      calcTotal,
      totalItemsCount,
    };
  }, [
    form.tickets, form.hotels, form.insurances, form.plans, form.checkIns,
    form.migrations, form.simCards, form.carRentals, form.fincas, form.tours,
    form.conventions, form.restaurants, form.visas, form.passports, form.petServices
  ]);

  // Sync state if calculated totals differ from stored form state
  useEffect(() => {
    const { calcSupplierCost, calcTa, calcTotal } = totals;

    if (
      form.supplierCost !== calcSupplierCost.toString() ||
      form.ta !== calcTa.toString() ||
      form.total !== calcTotal.toString()
    ) {
      setForm((prev) => {
        const commPercentage = parseFloat(prev.commissionAgentPercentage || "0");
        const newCommAmount = calcTa * (commPercentage / 100);
        const retention = parseFloat(prev.commissionAgentRetentionPercentage || "0");
        const newCommNet = newCommAmount * (1 - retention / 100);

        return {
          ...prev,
          supplierCost: calcSupplierCost.toString(),
          ta: calcTa.toString(),
          total: calcTotal.toString(),
          commissionAgentAmount: newCommAmount.toString(),
          commissionAgentNetPayment: newCommNet.toString(),
        };
      });
    }
  }, [totals, form.supplierCost, form.ta, form.total, setForm]);

  return totals;
}
