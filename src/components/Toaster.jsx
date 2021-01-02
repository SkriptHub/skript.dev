// Pulled from https://blueprintjs.com/docs/#core/components/toast.example
import { Position, Toaster } from "@blueprintjs/core";
 
/** Singleton toaster instance. Create separate instances for different options. */
export const AppToaster = Toaster.create({
    position: Position.BOTTOM_RIGHT
});