import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Job } from "../../types";
import { cn } from "../../utils/style";

type Props = {
    className?: string;
    defaultPage?: number;
};

export type LastJobState = Job | undefined;

export type PaginationState = {
    page: number;
    maxPage: number;
};

export function Pagination({ className, defaultPage = 1 }: Props) {
    const queryClient = useQueryClient();
    const { data: lastJobState } = useQuery<LastJobState>({
        queryKey: ["lastJob"],
        queryFn: async () => {
            const response = await fetch("/api/jobs?limit=1&status=completed", {
                method: "GET",
            });
            const json = await response.json();

            return json.data[0];
        },
        refetchOnMount: true,
        enabled: true,
        cacheTime: 0,
        staleTime: 0,
    });
    const {
        data: paginationState = {
            page: defaultPage,
            maxPage: defaultPage,
        },
    } = useQuery<PaginationState>({
        queryKey: ["paginationState"],
        queryFn: () => {
            return (
                queryClient.getQueryData<PaginationState>(["paginationState"]) ?? {
                    page: defaultPage,
                    maxPage: defaultPage,
                }
            );
        },
        staleTime: Infinity,
    });

    return (
        <div className={cn(className, "flex gap-2 w-full justify-between items-center")}>
            {lastJobState ? (
                <div className="text-xs text-gray-500">
                    Last updated at: {dayjs(lastJobState.startTime).format("MM/DD HH:mm")}
                </div>
            ) : (
                <div />
            )}

            <div className="flex gap-2">
                <button
                    className="flex items-center rounded-lg px-2.5 py-1 enabled:hover:bg-gray-800"
                    disabled={paginationState.page <= 1}
                    onClick={() =>
                        queryClient.setQueryData(["paginationState"], {
                            page: paginationState.page - 1,
                            maxPage: paginationState.maxPage,
                        })
                    }
                    type="button"
                >
                    Previous
                </button>

                <button className="flex items-center px-2.5 py-1" type="button">
                    {paginationState.page}
                </button>

                <button
                    className="flex items-center rounded-lg px-2.5 py-1 enabled:hover:bg-gray-800"
                    disabled={paginationState.page >= paginationState.maxPage}
                    onClick={() =>
                        queryClient.setQueryData(["paginationState"], {
                            page: paginationState.page + 1,
                            maxPage: paginationState.maxPage,
                        })
                    }
                    type="button"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
