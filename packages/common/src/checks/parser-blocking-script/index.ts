import {
  LiquidCheckDefinition,
  LiquidHtmlNodeTypes as NodeTypes,
  Severity,
  SourceCodeType,
} from '../../types';
import { last } from '../../utils';
import { isAttr, isHtmlAttribute, isValuedHtmlAttribute } from '../utils';
import { liquidFilterSuggestion, scriptTagSuggestion } from './suggestions';

export const ParserBlockingScript: LiquidCheckDefinition = {
  meta: {
    code: 'ParserBlockingScript',
    name: 'Avoid parser blocking scripts',
    docs: {
      description: 'They are bad ok?',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      // {{ 'asset' | asset_url | script_tag }}
      LiquidFilter: async (node, ancestors) => {
        if (node.name !== 'script_tag') return;

        const filterString = node.source.slice(node.position.start, node.position.end);
        const offset = filterString.indexOf('script_tag');
        const parentNode = last(ancestors);
        const grandParentNode = last(ancestors, -1);

        context.report({
          message:
            'The script_tag filter is parser-blocking. Use a <script> tag with async or defer for better performance',
          startIndex: node.position.start + offset,
          endIndex: node.position.end,
          suggest:
            grandParentNode &&
            grandParentNode.type === NodeTypes.LiquidDrop &&
            parentNode &&
            parentNode.type === NodeTypes.LiquidVariable &&
            last(parentNode.filters) === node
              ? [
                  liquidFilterSuggestion('defer', node, parentNode, grandParentNode),
                  liquidFilterSuggestion('async', node, parentNode, grandParentNode),
                ]
              : undefined,
        });
      },

      // <script src="...">
      HtmlRawNode: async (node) => {
        if (node.name !== 'script') {
          return;
        }

        const hasSrc = node.attributes
          .filter(isValuedHtmlAttribute)
          .some((attr) => isAttr(attr, 'src'));

        if (!hasSrc) {
          return;
        }

        const hasDeferOrAsync = node.attributes
          .filter(isHtmlAttribute)
          .some((attr) => isAttr(attr, 'async') || isAttr(attr, 'defer'));

        if (hasDeferOrAsync) {
          return;
        }

        context.report({
          message: 'Avoid parser blocking scripts by adding `defer` or `async` on this tag',
          startIndex: node.position.start,
          endIndex: node.position.end,
          suggest: [scriptTagSuggestion('defer', node), scriptTagSuggestion('async', node)],
        });
      },
    };
  },
};
