#!/usr/bin/env python3
"""
Braided → Obsidian Vault sync
セッションデータをディレクトリ構造のMarkdownファイルに書き出す
"""
import json
import re
from datetime import datetime
from pathlib import Path


# ─── Helpers ──────────────────────────────────────────────────────────────────

def sanitize(s, max_len=50):
    """ファイル名として安全な文字列に変換"""
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', str(s))
    s = re.sub(r'\s+', ' ', s).strip()
    return s[:max_len] if s else 'untitled'


def fmt_date(ts_ms):
    if not ts_ms:
        return ''
    try:
        return datetime.fromtimestamp(ts_ms / 1000).strftime('%Y-%m-%d %H:%M')
    except Exception:
        return ''


def yaml_block(data):
    """外部ライブラリなしでYAMLフロントマターを生成"""
    lines = ['---']
    for k, v in data.items():
        if v is None:
            continue
        if isinstance(v, list):
            if not v:
                continue
            lines.append(f'{k}:')
            for item in v:
                lines.append(f'  - "{item}"')
        elif isinstance(v, bool):
            lines.append(f'{k}: {str(v).lower()}')
        elif isinstance(v, (int, float)):
            lines.append(f'{k}: {v}')
        else:
            sv = str(v)
            if any(c in sv for c in ':#{}[]|>&!\'"'):
                sv = sv.replace('"', '\\"')
                lines.append(f'{k}: "{sv}"')
            else:
                lines.append(f'{k}: {sv}')
    lines.append('---')
    return '\n'.join(lines)


def write_file(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def get_node(nodes, nid):
    return next((n for n in nodes if n.get('id') == nid), None)


def q_seq(nodes, node_id):
    qs = sorted(
        [n for n in nodes if n.get('type') == 'q'],
        key=lambda n: n.get('timestamp', 0)
    )
    idx = next((i for i, n in enumerate(qs) if n.get('id') == node_id), -1)
    return idx + 1 if idx >= 0 else 0


def model_short(model_str):
    """'anthropic:claude-sonnet-4-6' → 'claude-sonnet-4-6'"""
    return (model_str or '').split(':')[-1] or '?'


def provider_short(model_str):
    return (model_str or '').split(':')[0] or '?'


# ─── Main entry ───────────────────────────────────────────────────────────────

def sync_session(vault_path, session):
    nodes = session.get('nodes', [])
    if not nodes:
        return {'status': 'empty', 'message': 'No nodes to sync'}

    sess_name = sanitize(session.get('title', 'untitled'))
    sess_dir  = Path(vault_path) / 'Braided' / sess_name
    sess_dir.mkdir(parents=True, exist_ok=True)

    # ── .braided.json (ツリー全体の接続情報) ────────────────────────────────
    tree_meta = {
        'id':      session.get('id'),
        'title':   session.get('title'),
        'created': fmt_date(session.get('created')),
        'nodes': [
            {
                'id':        n.get('id'),
                'type':      n.get('type'),
                'seq':       q_seq(nodes, n['id']) if n.get('type') == 'q' else None,
                'model':     n.get('model'),
                'parentId':  n.get('parentId'),
                'parentIds': n.get('parentIds'),
                'excluded':  n.get('excluded', False),
                'timestamp': fmt_date(n.get('timestamp')),
            }
            for n in nodes
        ],
        'edges': [
            {'from': n.get('parentId'), 'to': n.get('id'), 'type': 'branch'
                if _is_branch_edge(nodes, n) else 'main'}
            for n in nodes if n.get('parentId')
        ] + [
            {'from': pid, 'to': n.get('id'), 'type': 'merge'}
            for n in nodes if n.get('parentIds')
            for pid in n.get('parentIds', [])
        ],
    }
    write_file(sess_dir / '.braided.json',
               json.dumps(tree_meta, ensure_ascii=False, indent=2))

    # ── ルートQノードを辿って再帰書き出し ────────────────────────────────────
    root_qs = [n for n in nodes
               if n.get('type') == 'q'
               and not n.get('parentId')
               and not n.get('parentIds')]
    for rq in root_qs:
        _write_branch(sess_dir, nodes, rq)

    # ── マージノード ─────────────────────────────────────────────────────────
    merges = [n for n in nodes if n.get('parentIds')]
    if merges:
        merges_dir = sess_dir / 'Merges'
        merges_dir.mkdir(exist_ok=True)
        for i, m in enumerate(merges, 1):
            _write_merge_file(merges_dir / f'Merge-{i}.md', m, nodes)

    return {'status': 'ok', 'path': str(sess_dir)}


def save_sessions_backup(vault_path, all_sessions):
    """全セッションを sessions.json としてバックアップ保存"""
    backup_path = Path(vault_path) / 'Braided' / 'sessions.json'
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    write_file(backup_path, json.dumps(all_sessions, ensure_ascii=False, indent=2))
    return str(backup_path)


def load_sessions_backup(vault_path):
    """sessions.json からセッションデータをロード"""
    backup_path = Path(vault_path) / 'Braided' / 'sessions.json'
    if not backup_path.exists():
        return None
    try:
        return json.loads(backup_path.read_text(encoding='utf-8'))
    except Exception:
        return None


def _is_branch_edge(nodes, node):
    parent = get_node(nodes, node.get('parentId'))
    return parent and parent.get('type') == 'r'


# ─── Recursive branch writer ──────────────────────────────────────────────────

def _write_branch(dir_path, nodes, q_node):
    seq    = q_seq(nodes, q_node['id'])
    r_nodes = [n for n in nodes if n.get('parentId') == q_node['id'] and n.get('type') == 'r']
    sigma   = next((n for n in nodes
                    if n.get('parentId') == q_node['id'] and n.get('type') == 'sigma'), None)

    # 分岐元を特定
    parent = get_node(nodes, q_node.get('parentId'))
    branch_from = None
    if parent and parent.get('type') == 'r':
        pq_seq = q_seq(nodes, parent.get('parentId', ''))
        branch_from = f"Q{pq_seq}-{model_short(parent.get('model'))}"

    # Q ファイル名
    fname = (f"Q{seq}_from-{sanitize(branch_from, 25)}.md"
             if branch_from else f"Q{seq}.md")

    # Σ ファイル名（Obsidian リンク用）
    sigma_link = f"[[Q{seq}-Σ]]" if sigma else None

    # ── Qファイル書き出し ──────────────────────────────────────────────────
    _write_q_file(dir_path / fname, q_node, r_nodes, sigma, nodes,
                  branch_from, sigma_link)

    # ── Σファイル書き出し ──────────────────────────────────────────────────
    if sigma:
        _write_sigma_file(dir_path / f"Q{seq}-Σ.md", sigma, q_node, nodes)
        follow_qs = [n for n in nodes
                     if n.get('parentId') == sigma['id'] and n.get('type') == 'q']
        for fq in follow_qs:
            _write_branch(dir_path, nodes, fq)
    else:
        direct_qs = [n for n in nodes
                     if n.get('parentId') == q_node['id'] and n.get('type') == 'q']
        for dq in direct_qs:
            _write_branch(dir_path, nodes, dq)

    # ── Rノードからの派生分岐をサブディレクトリへ ─────────────────────────
    for r in r_nodes:
        branch_qs = [n for n in nodes
                     if n.get('parentId') == r['id'] and n.get('type') == 'q']
        if not branch_qs:
            continue
        mname     = sanitize(model_short(r.get('model')), 20)
        branch_dir = dir_path / 'Branches' / f"Q{seq}-{mname}"
        branch_dir.mkdir(parents=True, exist_ok=True)

        # 分岐の接続情報
        branch_meta = {
            'branch_from_q':     f"Q{seq}",
            'branch_from_model': r.get('model'),
            'branch_from_node':  r.get('id'),
            'created':           fmt_date(r.get('timestamp')),
        }
        write_file(branch_dir / '.braided.json',
                   json.dumps(branch_meta, ensure_ascii=False, indent=2))

        for bq in branch_qs:
            _write_branch(branch_dir, nodes, bq)


# ─── File writers ─────────────────────────────────────────────────────────────

def _write_q_file(path, q_node, r_nodes, sigma, nodes, branch_from, sigma_link):
    seq = q_seq(nodes, q_node['id'])

    # Obsidian internal links
    links = []
    if sigma_link:
        links.append(sigma_link)
    for r in r_nodes:
        bqs = [n for n in nodes
               if n.get('parentId') == r['id'] and n.get('type') == 'q']
        if bqs:
            mname = sanitize(model_short(r.get('model')), 20)
            links.append(f"[[Branches/Q{seq}-{mname}/Q{q_seq(nodes, bqs[0]['id'])}]]")

    fm = yaml_block({
        'braided_type':  'question',
        'braided_seq':   seq,
        'branch_from':   branch_from,
        'created':       fmt_date(q_node.get('timestamp')),
        'models':        [r.get('model', '') for r in r_nodes if not r.get('excluded')],
        'has_summary':   sigma is not None,
        'tags':          ['braided', 'question'],
    })

    lines = [fm, '', f'# Q{seq}', '', q_node.get('content', ''), '']

    for r in r_nodes:
        mname    = model_short(r.get('model'))
        prov     = provider_short(r.get('model'))
        excluded = r.get('excluded', False)
        lines.append(f'## 🤖 {mname}  `{prov}`' + ('  *(除外済み)*' if excluded else ''))
        lines.append('')
        if not excluded and r.get('content'):
            lines.append(r['content'])
        lines.append('')

    if links:
        lines += ['---', '', '**See also:** ' + '  ·  '.join(links), '']

    write_file(path, '\n'.join(lines))


def _write_sigma_file(path, sigma, q_node, nodes):
    seq = q_seq(nodes, q_node['id'])
    fm  = yaml_block({
        'braided_type': 'summary',
        'braided_seq':  seq,
        'question':     f'[[Q{seq}]]',
        'created':      fmt_date(sigma.get('timestamp')),
        'tags':         ['braided', 'summary'],
    })
    lines = [
        fm, '',
        f'# Q{seq} — Σ 要約', '',
        f'> 元質問: [[Q{seq}]]', '',
        sigma.get('content', '') or '*(要約なし)*', '',
    ]
    write_file(path, '\n'.join(lines))


def _write_merge_file(path, merge_node, nodes):
    strategy = merge_node.get('strategy', 'merge')
    source_seqs = []
    for pid in (merge_node.get('parentIds') or []):
        pn = get_node(nodes, pid)
        if pn:
            pq = get_node(nodes, pn.get('parentId', ''))
            if pq:
                source_seqs.append(f"Q{q_seq(nodes, pq['id'])}-{model_short(pn.get('model'))}")

    fm = yaml_block({
        'braided_type': 'merge',
        'strategy':     strategy,
        'sources':      source_seqs,
        'created':      fmt_date(merge_node.get('timestamp')),
        'tags':         ['braided', 'merge'],
    })
    lines = [
        fm, '',
        f'# 🔀 マージ — {strategy}', '',
        '**Sources:** ' + '  ·  '.join(f'[[{s}]]' for s in source_seqs) if source_seqs else '',
        '',
        merge_node.get('content', '') or '*(マージ結果なし)*', '',
    ]
    write_file(path, '\n'.join(lines))
