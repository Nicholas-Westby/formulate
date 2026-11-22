using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.Core.DataValues;
using Formulate.Core.Folders;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Persistence;
using Formulate.Core.Validations;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class MoveServiceTests
{
    private static readonly Guid FormsRoot = FormConstantsRoot.Forms;

    private readonly FakeTreeEntityRepository _repository = new();

    private MoveService CreateService() => new(_repository);

    private PersistedFolder AddFolder(Guid root, params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var folder = new PersistedFolder { Id = id, Name = "folder", Path = new[] { root }.Concat(parents).Append(id).ToArray() };
        _repository.Add(folder);
        return folder;
    }

    private PersistedForm AddForm(params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var form = new PersistedForm { Id = id, Name = "form", Path = new[] { FormsRoot }.Concat(parents).Append(id).ToArray() };
        _repository.Add(form);
        return form;
    }

    private PersistedLayout AddLayout(PersistedForm form)
    {
        var id = Guid.NewGuid();
        var layout = new PersistedLayout { Id = id, Name = "layout", Path = form.Path.Append(id).ToArray() };
        _repository.Add(layout);
        return layout;
    }

    [Fact]
    public void Move_form_into_folder_updates_path_of_form_and_layouts()
    {
        var folder = AddFolder(FormsRoot);
        var form = AddForm();
        var layouts = new[] { AddLayout(form), AddLayout(form) };
        var bystander = AddForm();
        AddLayout(bystander);

        var result = CreateService().Move<PersistedForm>(form.Id, folder.Id);

        Assert.Equal(ServiceStatus.Success, result.Status);
        Assert.Equal(new[] { FormsRoot, folder.Id, form.Id }, form.Path);
        foreach (var layout in layouts)
        {
            Assert.Equal(new[] { FormsRoot, folder.Id, form.Id, layout.Id }, layout.Path);
        }

        Assert.Equal(3, _repository.PathUpdates.Count);
        Assert.Equal(1, _repository.DescendantLookups);
        Assert.Equal(0, _repository.ChildLookups);
        Assert.Equal(new[] { FormsRoot, bystander.Id }, bystander.Path);
    }

    [Fact]
    public void Move_to_null_target_moves_to_the_top_of_the_entitys_own_tree()
    {
        var folder = AddFolder(FormsRoot);
        var form = AddForm(folder.Id);
        var layout = AddLayout(form);

        Assert.Equal(ServiceStatus.Success, CreateService().Move<PersistedForm>(form.Id, null).Status);

        Assert.Equal(new[] { FormsRoot, form.Id }, form.Path);
        Assert.Equal(new[] { FormsRoot, form.Id, layout.Id }, layout.Path);
    }

    [Fact]
    public void Move_folder_moves_everything_under_it()
    {
        var target = AddFolder(FormsRoot);
        var folder = AddFolder(FormsRoot);
        var inner = AddFolder(FormsRoot, folder.Id);
        var form = AddForm(folder.Id, inner.Id);
        var layout = AddLayout(form);

        Assert.Equal(ServiceStatus.Success, CreateService().Move<PersistedFolder>(folder.Id, target.Id).Status);

        Assert.Equal(new[] { FormsRoot, target.Id, folder.Id }, folder.Path);
        Assert.Equal(new[] { FormsRoot, target.Id, folder.Id, inner.Id }, inner.Path);
        Assert.Equal(new[] { FormsRoot, target.Id, folder.Id, inner.Id, form.Id, layout.Id }, layout.Path);
    }

    [Fact]
    public void Move_into_self_or_descendant_is_rejected()
    {
        var folder = AddFolder(FormsRoot);
        var inner = AddFolder(FormsRoot, folder.Id);
        var deeper = AddFolder(FormsRoot, folder.Id, inner.Id);
        var pathBefore = folder.Path.ToArray();
        var service = CreateService();

        foreach (var target in new[] { folder.Id, inner.Id, deeper.Id })
        {
            var result = service.Move<PersistedFolder>(folder.Id, target);

            Assert.Equal((ServiceStatus.Invalid, "targetId"), (result.Status, result.Field));
        }

        Assert.Equal(pathBefore, folder.Path);
        Assert.Empty(_repository.PathUpdates);
    }

    [Fact]
    public void Move_into_other_tree_is_rejected()
    {
        var form = AddForm();
        var validationsFolder = AddFolder(FormConstantsRoot.Validations);
        var dataValuesFolder = AddFolder(FormConstantsRoot.DataValues);
        var service = CreateService();

        var intoValidations = service.Move<PersistedForm>(form.Id, validationsFolder.Id);
        var intoDataValues = service.Move<PersistedForm>(form.Id, dataValuesFolder.Id);

        Assert.Equal((ServiceStatus.Invalid, "targetId"), (intoValidations.Status, intoValidations.Field));
        Assert.Equal(ServiceStatus.Invalid, intoDataValues.Status);
        Assert.Equal(new[] { FormsRoot, form.Id }, form.Path);
        Assert.Empty(_repository.PathUpdates);
    }

    [Fact]
    public void Move_into_a_form_a_layout_or_a_missing_target_is_rejected()
    {
        var form = AddForm();
        var otherForm = AddForm();
        var layout = AddLayout(otherForm);
        var service = CreateService();

        foreach (var target in new[] { otherForm.Id, layout.Id, Guid.NewGuid() })
        {
            var result = service.Move<PersistedForm>(form.Id, target);

            Assert.Equal((ServiceStatus.Invalid, "targetId"), (result.Status, result.Field));
        }

        Assert.Empty(_repository.PathUpdates);
    }

    [Fact]
    public void Move_unknown_or_wrong_type_is_not_found()
    {
        var form = AddForm();
        var folder = AddFolder(FormsRoot);
        var service = CreateService();

        Assert.Equal(ServiceStatus.NotFound, service.Move<PersistedForm>(Guid.NewGuid(), null).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Move<PersistedForm>(folder.Id, null).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Move<PersistedFolder>(form.Id, null).Status);
    }
}
