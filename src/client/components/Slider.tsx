import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../utils/style";

type Props = {
    className?: string;
    min: number;
    max: number;
    onChange: (value: { min: number; max: number }) => void;
    formatter?: (value: number) => string;
};

// Heavily inspired by https://codesandbox.io/p/sandbox/multi-range-slider-react-js-forked-4uq1uo
export function Slider({ className, min, max, onChange, formatter }: Props) {
    const [minVal, setMinVal] = useState(min);
    const [maxVal, setMaxVal] = useState(max);
    const minValRef = useRef<number>(min);
    const maxValRef = useRef<number>(max);
    const range = useRef<HTMLDivElement>(null);

    const getPercent = useCallback(
        (value: number) => Math.round(((value - min) / (max - min)) * 100),
        [min, max]
    );
    useEffect(
        function setLeftBoundRange() {
            const minPercent = getPercent(minVal);
            const maxPercent = getPercent(maxValRef.current);

            if (range.current) {
                range.current.style.left = `${minPercent}%`;
                range.current.style.width = `${maxPercent - minPercent}%`;
            }
        },
        [minVal, getPercent]
    );
    useEffect(
        function setRightBoundRange() {
            const minPercent = getPercent(minValRef.current);
            const maxPercent = getPercent(maxVal);

            if (range.current) {
                range.current.style.width = `${maxPercent - minPercent}%`;
            }
        },
        [maxVal, getPercent]
    );
    useEffect(() => {
        onChange({ min: minVal, max: maxVal });
    }, [minVal, maxVal]);

    return (
        <div className={cn(className, "relative flex")}>
            <input
                type="range"
                min={min}
                max={max}
                value={minVal}
                onChange={(event) => {
                    const value = Math.min(Number(event.target.value), maxVal - 1);
                    setMinVal(value);
                    minValRef.current = value;
                }}
                className="absolute h-0 w-full pointer-events-none outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-gray-50 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_1px_1px_#ced4da] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:mt-1 [&::-moz-range-thumb]:bg-gray-50 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-[0_0_1px_1px_#ced4da] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:relative [&::-moz-range-thumb]:mt-1 z-3"
                style={{ zIndex: minVal > max - 100 ? 5 : undefined }}
            />
            <input
                type="range"
                min={min}
                max={max}
                value={maxVal}
                onChange={(event) => {
                    const value = Math.max(Number(event.target.value), minVal + 1);
                    setMaxVal(value);
                    maxValRef.current = value;
                }}
                className="absolute h-0 w-full pointer-events-none outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-gray-50 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_1px_1px_#ced4da] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:mt-1 [&::-moz-range-thumb]:bg-gray-50 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-[0_0_1px_1px_#ced4da] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:relative [&::-moz-range-thumb]:mt-1 z-4"
            />
            <div className="absolute bg-gray-800 rounded-xs h-1 w-full z-1" />
            <div ref={range} className="absolute rounded-xs h-1 z-2 bg-gray-300" />
            <div className="absolute text-gray-400 text-xs left-2 top-3">
                {formatter ? formatter(minVal) : minVal}
            </div>
            <div className="absolute text-gray-400 text-xs right-2 top-3">
                {formatter ? formatter(maxVal) : maxVal}
            </div>
        </div>
    );
}
