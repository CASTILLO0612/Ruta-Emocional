import React, { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';

type MessageBlock =
  | { readonly type: 'heading'; readonly text: string }
  | { readonly type: 'bullet'; readonly text: string }
  | { readonly type: 'numbered'; readonly text: string; readonly marker: string }
  | { readonly type: 'paragraph'; readonly text: string };

function parseMessage(message: string): readonly MessageBlock[] {
  const blocks: MessageBlock[] = [];
  let paragraph: string[] = [];
  const commitParagraph = () => {
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraph = [];
  };

  for (const rawLine of message.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      commitParagraph();
      continue;
    }

    const heading = line.match(/^#{1,3}(?:\s+(.+))?$/);
    if (heading) {
      commitParagraph();
      if (heading[1]) blocks.push({ type: 'heading', text: heading[1] });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      commitParagraph();
      blocks.push({ type: 'bullet', text: bullet[1] });
      continue;
    }

    const numbered = line.match(/^(\d+[.)])\s+(.+)$/);
    if (numbered) {
      commitParagraph();
      blocks.push({ type: 'numbered', marker: numbered[1], text: numbered[2] });
      continue;
    }

    paragraph.push(line);
  }
  commitParagraph();
  return blocks;
}

function InlineContent({ text }: { readonly text: string }) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return (
    <>
      {segments.map((segment, index) => {
        const emphasized = segment.startsWith('**') && segment.endsWith('**');
        return (
          <Text key={`${index}-${segment}`} style={emphasized ? styles.emphasis : undefined}>
            {emphasized ? segment.slice(2, -2) : segment}
          </Text>
        );
      })}
    </>
  );
}

export function MentaMessageContent({ message }: { readonly message: string }) {
  const blocks = parseMessage(message);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => (
        <Fragment key={`${block.type}-${index}`}>
          {block.type === 'heading' ? (
            <Text selectable style={styles.heading}>
              <InlineContent text={block.text} />
            </Text>
          ) : block.type === 'bullet' || block.type === 'numbered' ? (
            <View style={styles.listItem}>
              <Text style={styles.marker} accessibilityElementsHidden>
                {block.type === 'bullet' ? '•' : block.marker}
              </Text>
              <Text selectable style={styles.body}>
                <InlineContent text={block.text} />
              </Text>
            </View>
          ) : (
            <Text selectable style={styles.body}>
              <InlineContent text={block.text} />
            </Text>
          )}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
    gap: Spacing.sm,
  },
  heading: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  body: {
    ...Typography.body,
    flex: 1,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  marker: {
    ...Typography.body,
    minWidth: 18,
    color: Colors.primary,
    fontFamily: FontFamily.bodySemiBold,
    lineHeight: 23,
    textAlign: 'right',
  },
  emphasis: {
    fontFamily: FontFamily.bodySemiBold,
  },
});
