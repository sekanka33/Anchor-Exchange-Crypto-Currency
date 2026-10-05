import { useEffect, useRef } from "react";
import { useTheme } from "../hooks/useTheme";

// Live Binance candles via the TradingView embed; follows the app theme.
const TradingViewChart = ({ symbol, interval = "60", className = "w-full h-80" }) => {
  const { isDarkMode } = useTheme();
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${symbol}`,
      interval,
      timezone: "Etc/UTC",
      theme: isDarkMode ? "dark" : "light",
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_top_toolbar: true,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);
  }, [symbol, interval, isDarkMode]);

  return <div ref={containerRef} className={className} />;
};

export default TradingViewChart;
