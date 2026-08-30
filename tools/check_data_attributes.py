#!/usr/bin/env python3
"""Fails when a component styles itself by a data- attribute it never renders.

Half of shadcn's appearance is keyed off attributes React sets: `data-[state=checked]:bg-primary`,
`data-[orientation=vertical]:flex-col`, `data-[side=right]:border-l`. Port the class string
without the attribute and the rule matches nothing — no error, no warning, no colour. The switch
shipped with no background in either state that way, and every Field in the library laid itself
out as a row for the same reason.

This reads the .razor source rather than a render, because most of these attributes are
conditional: `data-disabled` appears only when the component is disabled, and a default render
proves nothing either way. What matters is whether the component can ever emit it.

    python tools/check_data_attributes.py           # report
    python tools/check_data_attributes.py --check   # CI: non-zero when something is unaccounted for
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMPONENTS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components'

# `data-[x=y]:` at the start of a variant chain is this element's own state. `group-data-`,
# `peer-data-` and `in-data-` describe an ancestor's or a sibling's, which this element does not
# set and must not be blamed for.
SELF = re.compile(r'(?<![\w-])(group-|peer-|in-)?data-\[([a-z-]+)[=\]]')
EMITS = re.compile(r'\bdata-([a-z-]+)=')

# Attributes ui.js writes at runtime, with the compiler that writes each one. An entry here is a
# promise that the JavaScript keeps it in step; anything not here belongs in the markup.
BY_COMPILER = {
    # The three states a drop zone passes through, all of them written by the compiler because
    # all three are answers to something the user did: a file over the zone, a request in
    # flight, a value in the field.
    "FileUpload.data-dragging": 'up.compiler(\'[data-slot="file-upload"]\')',
    "FileUpload.data-uploading": 'up.compiler(\'[data-slot="file-upload"]\')',
    "FileUpload.data-filled": 'up.compiler(\'[data-slot="file-upload"]\')',
    'Sheet.data-state': "up.compiler('dialog[data-slot]')",
    'Dialog.data-state': "up.compiler('dialog[data-slot]')",
    # A sidebar row can BE the trigger for a menu or a collapsible section, which is where
    # upstream's data-[state=open] on it comes from. When it is, it carries popovertarget and the
    # popover compiler marks it like any other trigger. When it is not, the rule simply never
    # fires, which is correct.
    'SidebarMenuButton.data-state': "up.compiler('[popover][data-slot]')",
    'SidebarMenuAction.data-state': "up.compiler('[popover][data-slot]')",
    'Tabs.data-state': 'up.compiler(\'[data-slot="tabs"]\')',
    'TabsTrigger.data-state': 'up.compiler(\'[data-slot="tabs"]\')',
    'CommandItem.data-selected': 'up.compiler(\'[data-slot="command"]\')',
    'DropdownMenuSubTrigger.data-state': 'up.compiler(\'[data-slot="dropdown-menu"]\')',
    'DropdownMenuSubContent.data-state': 'up.compiler(\'[data-slot="dropdown-menu"]\')',
    'DropdownMenuContent.data-state': 'up.compiler(\'[data-slot="dropdown-menu"]\')',
    'HoverCardContent.data-state': 'up.compiler(\'[data-slot="hover-card"]\')',
    'PopoverContent.data-state': 'up.compiler(\'[data-slot="popover"]\')',
    'InputOtpSlot.data-active': 'up.compiler(\'[data-slot="input-otp"]\')',
    'CodeBlock.data-copied': 'up.compiler(\'[data-slot="code-block-copy"]\')',
    'ResizableHandle.data-dragging': 'up.compiler(\'[data-slot="resizable-handle"]\')',
    'MessageScrollerButton.data-active': 'up.compiler(\'[data-slot="message-scroller"]\')',
}

# Every panel that is a [popover] gets data-state from one compiler, and so does its trigger:
# a chevron that turns when its own menu opens is written group-data-[state=open] on the trigger,
# not on the panel.
BY_COMPILER.update({
    f'{name}.data-state': "up.compiler('[popover][data-slot]')"
    for name in ('DropdownMenuContent', 'DropdownMenuTrigger', 'ContextMenuContent',
                 'ContextMenuSubContent', 'ContextMenuSubTrigger', 'MenubarContent',
                 'MenubarSubContent', 'MenubarSubTrigger', 'MenubarTrigger',
                 'NavigationMenuContent', 'NavigationMenuTrigger', 'ComboboxContent')
})

# Attributes a CALLER sets, because the state they describe is the caller's to know.
BY_CALLER = {
    'TableRow.data-state': 'a row is selected by whatever renders the table',
}

# Rules that cannot apply here, with what replaced the mechanism behind them.
NOT_APPLICABLE = {
    'NavigationMenuContent.data-motion':
        'Radix animates panels sliding past each other inside one shared viewport; each panel '
        'here is its own popover in the top layer, so there is no direction to animate from',
    'ComboboxContent.data-chips':
        'upstream marks the panel when the trigger is a chip frame so it can widen to match; '
        'the popover is measured against its anchor here, so the width follows already',
    'ContextMenuContent.data-side':
        'a context menu opens at the pointer, not on a side of an anchor',
}

# Attributes rendered by the component this one composes, as upstream composes it too.
BY_COMPOSITION = {
    'ButtonGroupSeparator.data-orientation': '<Separator> renders it from the Orientation passed in',
}


def main() -> int:
    problems = []
    checked = 0
    for path in sorted(COMPONENTS.glob('*.razor')):
        source = path.read_text(encoding='utf-8')
        wanted = {m.group(2) for m in SELF.finditer(source) if not m.group(1)}
        emitted = set(EMITS.findall(source))
        for attribute in sorted(wanted - emitted):
            key = f'{path.stem}.data-{attribute}'
            if key in BY_COMPILER or key in BY_CALLER or key in BY_COMPOSITION \
                    or key in NOT_APPLICABLE:
                continue
            problems.append(f'{path.stem}: styles itself with data-[{attribute}=…] '
                            f'and never renders data-{attribute}')
        checked += 1

    for line in problems:
        print(line, file=sys.stderr)

    if problems:
        print(f'\n{len(problems)} rules that match nothing. Render the attribute, or add it to '
              f'BY_COMPILER/BY_CALLER with what does.', file=sys.stderr)
        return 1

    print(f'{checked} components: every data- rule has an attribute to match '
          f'({len(BY_COMPILER)} set by a compiler, {len(BY_CALLER)} by the caller, '
          f'{len(BY_COMPOSITION)} by a composed component, '
          f'{len(NOT_APPLICABLE)} that cannot apply here)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
