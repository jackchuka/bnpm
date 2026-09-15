import type { Choice, FlowResult, Step } from '../mine/flows.ts'
import type { CustomKind } from '../mine/validate.ts'

export interface FlowPrompts {
  pick(title: string, choices: Choice[], allowCustom?: CustomKind): Promise<string>
  text(
    title: string,
    opts: { placeholder?: string | undefined; required?: boolean | undefined },
  ): Promise<string>
  typed(title: string, expected: string): Promise<string>
}

export async function driveFlow(
  gen: Generator<Step, FlowResult, string>,
  prompts: FlowPrompts,
): Promise<FlowResult> {
  let next = gen.next()
  while (!next.done) {
    const step = next.value
    const answer =
      step.type === 'pick'
        ? await prompts.pick(step.title, step.choices, step.allowCustom)
        : step.type === 'text'
          ? await prompts.text(step.title, {
              placeholder: step.placeholder,
              required: step.required,
            })
          : await prompts.typed(step.title, step.expected)
    next = gen.next(answer)
  }
  return next.value
}
