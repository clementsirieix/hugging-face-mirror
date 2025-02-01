import dayjs from "dayjs";
import { Download, Heart } from "lucide-react";
import { Model } from "../../types";
import { shortNumberFormatter } from "../../utils/format";

type Props = {
    model: Model;
};

export function Card({ model }: Props) {
    return (
        <a
            className="flex flex-col rounded-lg border border-gray-900 bg-gradient-to-r from-gray-900 via-gray-950 to-gray-950 text-base shadow-sm p-2"
            href={`https://huggingface.co/${model.id}`}
            target="_blank"
            rel="noopener noreferrer"
        >
            <div className="w-full truncate">{model.id}</div>
            <div className="w-full truncate text-xs text-gray-400 flex gap-1 items-center">
                <div>{model.pipeline_tag}</div>
                <div>•</div>
                <div>Updated at {dayjs(model.lastModified).format("MM/DD HH:mm")}</div>
                <div>•</div>
                <Download className="h-3 w-3" />
                {shortNumberFormatter.format(model.downloads)}
                <div>•</div>
                <Heart className="h-3 w-3" />
                <div className="flex items-center">{shortNumberFormatter.format(model.likes)}</div>
            </div>
        </a>
    );
}
