import { useApi } from "./useApi";
import { getFinanceConfig } from "../api/finance";

export const useFinanceConfig = () => useApi(getFinanceConfig, []);
