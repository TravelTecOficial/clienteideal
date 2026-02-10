import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/** Chaves de UI do react-day-picker v9 para aplicar estilos corretos (layout em tabela). */
const UI = {
  Root: "root",
  MonthGrid: "month_grid",
  Weekdays: "weekdays",
  Weekday: "weekday",
  Weeks: "weeks",
  Week: "week",
  Day: "day",
  DayButton: "day_button",
  MonthCaption: "month_caption",
  CaptionLabel: "caption_label",
  Nav: "nav",
  PreviousMonthButton: "button_previous",
  NextMonthButton: "button_next",
  Month: "month",
  Months: "months",
} as const satisfies Record<string, string>

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fixedWeeks = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      className={cn("p-3", className)}
      classNames={{
        [UI.Root]: "relative",
        [UI.Months]: "flex flex-col gap-4 sm:flex-row sm:gap-6",
        [UI.Month]: "relative space-y-4",
        [UI.MonthCaption]:
          "flex justify-center pt-1 relative h-9 items-center",
        [UI.CaptionLabel]: "text-sm font-medium",
        [UI.Nav]: "flex items-center gap-1 absolute top-1 right-0",
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        [UI.MonthGrid]:
          "w-full border-collapse table-fixed min-w-[16.5rem]",
        [UI.Weekdays]: "",
        [UI.Weekday]:
          "text-muted-foreground w-9 min-w-[2.25rem] rounded-md p-0 font-normal text-[0.8rem] text-center align-middle",
        [UI.Weeks]: "",
        [UI.Week]: "",
        [UI.Day]:
          "relative h-9 min-w-[2.25rem] w-[2.25rem] p-0 text-center text-sm align-middle [&:has([aria-selected])]:bg-accent [&:has([aria-selected].outside)]:bg-accent/50 [&:has([aria-selected])]:text-accent-foreground focus-within:relative focus-within:z-20",
        [UI.DayButton]: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 min-w-9 p-0 font-normal aria-selected:opacity-100 inline-flex items-center justify-center"
        ),
        outside:
          "outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...(classNames as Record<string, string>),
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}

