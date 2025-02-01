import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "../../utils/style";
import { Slider } from "./Slider";

type Props = {
    className?: string;
    defaultSearch?: string;
    defaultMinSize?: number;
    defaultMaxSize?: number;
};

const SIZE_MAP: Record<number, { label: string; value: number }> = {
    0: {
        label: "1MB",
        value: 1048576,
    },
    1: {
        label: "10MB",
        value: 10485760,
    },
    2: {
        label: "100MB",
        value: 104857600,
    },
    3: {
        label: "1GB",
        value: 1073741824,
    },
    4: {
        label: "10GB",
        value: 10737418240,
    },
    5: {
        label: "100GB",
        value: 107374182400,
    },
    6: {
        label: "1TB",
        value: 1099511627776,
    },
    7: {
        label: "10TB",
        value: 10995116277760,
    },
    8: {
        label: "100TB",
        value: 109951162777600,
    },
} as const;

export type SearchState = {
    search: string;
    minSize?: number;
    maxSize?: number;
};

export function Search({
    className,
    defaultSearch = "",
    defaultMaxSize = 8,
    defaultMinSize = 0,
}: Props) {
    const queryClient = useQueryClient();
    const {
        data: searchState = {
            search: defaultSearch,
            minSize: defaultMinSize,
            maxSize: defaultMaxSize,
        },
    } = useQuery<SearchState>({
        queryKey: ["searchState"],
        queryFn: () => {
            return (
                queryClient.getQueryData<SearchState>(["searchState"]) ?? {
                    search: defaultSearch,
                    minSize: defaultMinSize,
                    maxSize: defaultMaxSize,
                }
            );
        },
        staleTime: Infinity,
    });

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        queryClient.setQueryData(["paginationState"], {
            page: 1,
            maxPage: 1,
        });
        queryClient.setQueryData(["searchState"], {
            search: event.target.value,
            minSize: searchState.minSize,
            maxSize: searchState.maxSize,
        });
    };
    const handleSizeChange = (value: { min: number; max: number }) => {
        queryClient.setQueryData(["paginationState"], {
            page: 1,
            maxPage: 1,
        });
        queryClient.setQueryData(["searchState"], {
            search: searchState.search,
            minSize: value.min === 0 ? undefined : SIZE_MAP[value.min].value,
            maxSize:
                value.max === Object.keys(SIZE_MAP).length - 1
                    ? undefined
                    : SIZE_MAP[value.max].value,
        });
    };

    return (
        <div className={cn(className, "flex flex-col gap-2 w-full")}>
            <div className="flex gap-2 w-full rounded-full border border-gray-400 shadow-inner bg-gray-950 px-4">
                <input
                    type="text"
                    className="flex-grow h-10 text-base placeholder-gray-500 border-none focus:outline-none"
                    placeholder="Search for a model"
                    onChange={handleSearchChange}
                    value={searchState.search}
                />
            </div>

            <div className="flex w-full gap-2 px-4 justify-end">
                <div className="text-gray-500">Size:</div>

                <Slider
                    className="w-40 mt-2.5"
                    min={0}
                    max={8}
                    onChange={handleSizeChange}
                    formatter={(value) => (value in SIZE_MAP ? SIZE_MAP[value].label : "Unknown")}
                />
            </div>
        </div>
    );
}
