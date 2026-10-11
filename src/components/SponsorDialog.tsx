import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { DialogRootChangeEventDetails } from "@base-ui/react";

export function SponsorDialog({
    open,
    onOpenChange,
    priceUSD,
    time,
}: {
    open: boolean;
    onOpenChange: (
        open: boolean,
        eventDetails: DialogRootChangeEventDetails,
    ) => void;
    priceUSD: number | string;
    time: string;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="text-md sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl">
                        Sponsor PureCanvas
                    </DialogTitle>
                    {/*<DialogDescription>

                    </DialogDescription>*/}
                </DialogHeader>
                <div className="flex flex-row gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                        <p className="font-bold">
                            This spot is available for ${priceUSD} (USD)!
                        </p>
                        <p>
                            You can choose the text, icon, and a link to your
                            project. This button will appear for all users on
                            every session. It will stay for {time}, after which
                            you will have to purchase it again or it will be
                            gone.
                        </p>
                        <p>
                            This is a great opportunity to get low-cost advertising
                            in a growing app.
                        </p>
                        <p>
                            To purchase or learn more, please email{" "}
                            <a
                                href="mailto:teccin+purecanvas@proton.me?subject=PureCanvas%20Sponsorship"
                                target="_blank"
                                className="underline decoration-muted-foreground hover:decoration-foreground"
                            >
                                teccin@proton.me
                            </a>
                            .
                        </p>
                        <p className="italic text-sm">
                            Acceptance not guaranteed. Additional terms apply.
                            Payable in most currencies and crypto.
                        </p>
                    </div>
                    <img src="/sponsor-header.png" className="w-62 max-h-62 shrink-0 object-contain"></img>
                </div>
            </DialogContent>
        </Dialog>
    );
}
