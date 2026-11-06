const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
require('../scripts/register.cjs');
const { buildExplorer, disposeExplorer } = require('../src/three/explorerMeshes');
for (const id of ['pathfinder', 'voyager', 'lander']) {
  test(`${id}: finite geometry, bounded detail and complete disposal`, () => {
    for (const quality of ['low', 'high']) {
      const craft = buildExplorer(id, quality);
      const bounds = new THREE.Box3().setFromObject(craft);
      assert.ok(!bounds.isEmpty());
      for (const v of [...bounds.min.toArray(), ...bounds.max.toArray()]) assert.ok(Number.isFinite(v));
      assert.ok(bounds.max.x - bounds.min.x < 20);
      const geometries = new Set(), materials = new Set();
      let triangles = 0;
      craft.traverse(o => {
        if (o.geometry) {
          geometries.add(o.geometry);
          triangles += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
          for (const n of o.geometry.attributes.position.array) assert.ok(Number.isFinite(n));
        }
        if(o.material) materials.add(o.material);
      });
      assert.ok(triangles < 20000, `${triangles} triangles`);
      assert.equal(craft.userData.plume.visible, false);
      let disposedGeometry = 0, disposedMaterial = 0;
      geometries.forEach(g => g.addEventListener('dispose', () => disposedGeometry++));
      materials.forEach(m => m.addEventListener('dispose', () => disposedMaterial++));
      disposeExplorer(craft);
      assert.equal(disposedGeometry, geometries.size);
      assert.equal(disposedMaterial, materials.size);
    }
  });
}
test('craft have distinct silhouettes and aft-facing exhaust', () => {
  const sizes = ['pathfinder', 'voyager', 'lander'].map(id => {
    const craft = buildExplorer(id);
    const size = new THREE.Box3().setFromObject(craft).getSize(new THREE.Vector3()).toArray();
    const plume = craft.userData.plume;
    assert.ok(plume.position.y < 0);
    plume.children.forEach(m => {
      const tip = new THREE.Vector3(0, m.geometry.parameters.height / 2, 0).applyQuaternion(m.quaternion).add(m.position);
      assert.ok(tip.y < m.position.y);
    });
    disposeExplorer(craft);
    return size.join(',');
  });
  assert.equal(new Set(sizes).size, 3);
});
