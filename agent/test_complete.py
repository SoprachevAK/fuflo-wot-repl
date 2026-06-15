"""Verify live completion attaches typed signatures (py2.7 or 3.x)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from wms_agent import handlers


def main():
    ns = sys.modules['__main__'].__dict__

    def spaceLoadStatus(*a, **k):
        pass
    spaceLoadStatus.__doc__ = 'spaceLoadStatus(distance: float = -1.0) -> float'

    class Avatar(object):
        pass

    ns['spaceLoadStatus'] = spaceLoadStatus
    ns['Avatar'] = Avatar
    ns['spaceConst'] = 42

    out = handlers.handle_complete({'id': 'c', 'type': 'complete', 'prefix': u'space'})
    by_name = dict((c['name'], c) for c in out['candidates'])

    fn = by_name.get('spaceLoadStatus')
    assert fn, by_name
    assert fn.get('signature') == '(distance: float = -1.0) -> float', fn
    assert fn.get('kind') == 'function', fn

    const = by_name.get('spaceConst')
    assert const and const.get('kind') == 'int', const

    out2 = handlers.handle_complete({'id': 'c', 'type': 'complete', 'prefix': u'Avat'})
    cls = dict((c['name'], c) for c in out2['candidates']).get('Avatar')
    assert cls and cls.get('kind') == 'class', cls

    print('COMPLETE OK -- sig=%r kind(const)=%s kind(cls)=%s' % (
        fn['signature'], const['kind'], cls['kind']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
