using Formulate.BackOffice.Api;
using Formulate.BackOffice.Api.Models.Folder;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.Core.Folders;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class FolderApiServiceTests
{
    private readonly TreeHarness _tree = new();

    private FolderApiService CreateService() => new(
        _tree.Tree,
        _tree.Repositories.Folders,
        _tree.Repositories.Forms,
        _tree.Repositories.Layouts,
        _tree.Repositories.DataValues,
        _tree.Repositories.Validations);

    private static Guid RootOf(string treeAlias) => treeAlias switch
    {
        TreeAliases.Forms => FormConstantsRoot.Forms,
        TreeAliases.DataValues => FormConstantsRoot.DataValues,
        _ => FormConstantsRoot.Validations,
    };

    private static T Ok<T>(ServiceResult<T> result)
    {
        Assert.True(result.Status == ServiceStatus.Success, $"{result.Status}: {result.Field} {result.Message}");
        return result.Value!;
    }

    private static (ServiceStatus, string?) Tuple<T>(ServiceResult<T> result) => (result.Status, result.Field);

    [Theory]
    [InlineData(TreeAliases.Forms)]
    [InlineData(TreeAliases.DataValues)]
    [InlineData(TreeAliases.Validations)]
    public void Create_then_get_folder_roundtrips_in_each_tree(string treeAlias)
    {
        var service = CreateService();
        var parent = Ok(service.Create(new CreateFolderRequestModel { Id = Guid.NewGuid(), TreeAlias = treeAlias, Name = "Top" }));
        var id = Guid.NewGuid();

        Ok(service.Create(new CreateFolderRequestModel { Id = id, ParentId = parent.Id, TreeAlias = treeAlias, Name = "Inner" }));
        var got = Ok(service.Get(id));

        Assert.Equal((id, "Inner", parent.Id, treeAlias), (got.Id, got.Name, got.ParentId, got.TreeAlias));
        Assert.Null(parent.ParentId);
        Assert.Equal(new[] { RootOf(treeAlias), parent.Id, id }, _tree.Repositories.Folders.Get(id).Path);
    }

    [Fact]
    public void Create_validates_name_id_and_tree_alias_naming_the_field()
    {
        var service = CreateService();
        var form = _tree.AddForm();

        Assert.Equal((ServiceStatus.Invalid, "name"), Tuple(service.Create(new CreateFolderRequestModel { Id = Guid.NewGuid(), TreeAlias = TreeAliases.Forms, Name = " " })));
        Assert.Equal((ServiceStatus.Invalid, "id"), Tuple(service.Create(new CreateFolderRequestModel { Id = Guid.Empty, TreeAlias = TreeAliases.Forms, Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "treeAlias"), Tuple(service.Create(new CreateFolderRequestModel { Id = Guid.NewGuid(), TreeAlias = "layouts", Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "treeAlias"), Tuple(service.Create(new CreateFolderRequestModel { Id = Guid.NewGuid(), TreeAlias = "", Name = "x" })));
        Assert.Equal((ServiceStatus.Conflict, "id"), Tuple(service.Create(new CreateFolderRequestModel { Id = form.Id, TreeAlias = TreeAliases.Forms, Name = "x" })));
        Assert.Empty(_tree.Repositories.FolderStore.GetAll());
    }

    [Fact]
    public void Create_in_folder_of_other_tree_is_rejected()
    {
        var service = CreateService();
        var validationsFolder = _tree.AddFolder(FormConstantsRoot.Validations);
        var form = _tree.AddForm();

        Assert.Equal((ServiceStatus.Invalid, "parentId"), Tuple(service.Create(new CreateFolderRequestModel { Id = Guid.NewGuid(), ParentId = validationsFolder.Id, TreeAlias = TreeAliases.Forms, Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "parentId"), Tuple(service.Create(new CreateFolderRequestModel { Id = Guid.NewGuid(), ParentId = form.Id, TreeAlias = TreeAliases.Forms, Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "parentId"), Tuple(service.Create(new CreateFolderRequestModel { Id = Guid.NewGuid(), ParentId = Guid.NewGuid(), TreeAlias = TreeAliases.Forms, Name = "x" })));
        Assert.Single(_tree.Repositories.FolderStore.GetAll());
    }

    [Fact]
    public void Update_folder_keeps_alias()
    {
        var folder = _tree.AddFolder(FormConstantsRoot.Forms);
        var parent = _tree.AddFolder(FormConstantsRoot.Forms);
        var inner = _tree.AddFolder(FormConstantsRoot.Forms, parent.Id);
        inner.Alias = "kept-alias";
        _tree.Repositories.Folders.Save(inner);

        var updated = Ok(CreateService().Update(inner.Id, new UpdateFolderRequestModel { Name = "Renamed" }));

        var stored = _tree.Repositories.Folders.Get(inner.Id);
        Assert.Equal("Renamed", updated.Name);
        Assert.Equal("Renamed", stored.Name);
        Assert.Equal("kept-alias", stored.Alias);
        Assert.Equal(new[] { FormConstantsRoot.Forms, parent.Id, inner.Id }, stored.Path);
        Assert.Equal(parent.Id, updated.ParentId);
        Assert.Equal("folder-alias", _tree.Repositories.Folders.Get(folder.Id).Alias);
    }

    [Fact]
    public void Update_rejects_an_empty_name_and_unknown_items_are_not_found()
    {
        var service = CreateService();
        var folder = _tree.AddFolder(FormConstantsRoot.Forms);
        var form = _tree.AddForm();

        Assert.Equal((ServiceStatus.Invalid, "name"), Tuple(service.Update(folder.Id, new UpdateFolderRequestModel { Name = "" })));
        Assert.Equal(ServiceStatus.NotFound, service.Get(Guid.NewGuid()).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Get(form.Id).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Update(Guid.NewGuid(), new UpdateFolderRequestModel { Name = "x" }).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Delete(Guid.NewGuid()).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Delete(form.Id).Status);
    }

    [Fact]
    public void Delete_folder_cascades()
    {
        var root = FormConstantsRoot.Forms;
        var folder = _tree.AddFolder(root);
        var sub = _tree.AddFolder(root, folder.Id);
        var formInFolder = _tree.AddForm(folder.Id);
        var formInSub = _tree.AddForm(folder.Id, sub.Id);
        var layouts = new[] { _tree.AddLayout(formInFolder), _tree.AddLayout(formInSub) };
        var untouchedForm = _tree.AddForm();
        var untouchedFolder = _tree.AddFolder(root);
        var readsBefore = _tree.Repositories.FormStore.FullReads + _tree.Repositories.LayoutStore.FullReads + _tree.Repositories.FolderStore.FullReads
            + _tree.Repositories.ValidationStore.FullReads + _tree.Repositories.DataValuesStore.FullReads;

        var deleted = Ok(CreateService().Delete(folder.Id));

        var expected = new[] { folder.Id, sub.Id, formInFolder.Id, formInSub.Id, layouts[0].Id, layouts[1].Id };
        Assert.Equal(expected.OrderBy(x => x), deleted.DeletedIds.OrderBy(x => x));
        Assert.Equal(folder.Id, deleted.DeletedIds[^1]);
        Assert.All(expected, x => Assert.Null(_tree.Tree.Get(x)));
        Assert.NotNull(_tree.Repositories.Forms.Get(untouchedForm.Id));
        Assert.NotNull(_tree.Repositories.Folders.Get(untouchedFolder.Id));

        // Each of the five repositories is read once, however deep the folder goes.
        Assert.Equal(readsBefore + 5, _tree.Repositories.FormStore.FullReads + _tree.Repositories.LayoutStore.FullReads + _tree.Repositories.FolderStore.FullReads
            + _tree.Repositories.ValidationStore.FullReads + _tree.Repositories.DataValuesStore.FullReads);
    }

    [Fact]
    public void Delete_folder_removes_validations_and_data_values_under_it_reading_each_repository_once()
    {
        var validationsFolder = _tree.AddFolder(FormConstantsRoot.Validations);
        var validation = _tree.AddValidation(validationsFolder.Id);
        var dataValuesFolder = _tree.AddFolder(FormConstantsRoot.DataValues);
        var dataValues = _tree.AddDataValues(dataValuesFolder.Id);
        var service = CreateService();

        var deletedValidations = Ok(service.Delete(validationsFolder.Id));
        var deletedDataValues = Ok(service.Delete(dataValuesFolder.Id));

        Assert.Equal(new[] { validation.Id, validationsFolder.Id }, deletedValidations.DeletedIds);
        Assert.Equal(new[] { dataValues.Id, dataValuesFolder.Id }, deletedDataValues.DeletedIds);
        Assert.Null(_tree.Repositories.Validations.Get(validation.Id));
        Assert.Null(_tree.Repositories.DataValues.Get(dataValues.Id));
        // Two deletes, so each repository was read once per delete and no more.
        Assert.Equal(2, _tree.Repositories.ValidationStore.FullReads);
        Assert.Equal(2, _tree.Repositories.DataValuesStore.FullReads);
        Assert.Equal(2, _tree.Repositories.FolderStore.FullReads);
        Assert.Equal(2, _tree.Repositories.FormStore.FullReads);
        Assert.Equal(2, _tree.Repositories.LayoutStore.FullReads);
    }

    [Fact]
    public void Moving_a_folder_rewrites_the_path_of_every_descendant_in_one_read_per_repository()
    {
        var root = FormConstantsRoot.Forms;
        var folder = _tree.AddFolder(root);
        var sub = _tree.AddFolder(root, folder.Id);
        var form = _tree.AddForm(folder.Id, sub.Id);
        var layout = _tree.AddLayout(form);
        var target = _tree.AddFolder(root);
        var readsBefore = _tree.Repositories.FormStore.FullReads;

        var result = new MoveService(_tree.Tree).Move<PersistedFolder>(folder.Id, target.Id);

        Assert.Equal(ServiceStatus.Success, result.Status);
        Assert.Equal(new[] { root, target.Id, folder.Id }, _tree.Repositories.Folders.Get(folder.Id).Path);
        Assert.Equal(new[] { root, target.Id, folder.Id, sub.Id }, _tree.Repositories.Folders.Get(sub.Id).Path);
        Assert.Equal(new[] { root, target.Id, folder.Id, sub.Id, form.Id }, _tree.Repositories.Forms.Get(form.Id).Path);
        Assert.Equal(new[] { root, target.Id, folder.Id, sub.Id, form.Id, layout.Id }, _tree.Repositories.Layouts.Get(layout.Id).Path);
        Assert.Equal(readsBefore + 1, _tree.Repositories.FormStore.FullReads);
    }

    [Fact]
    public void Moving_a_folder_into_its_own_descendant_changes_nothing()
    {
        var root = FormConstantsRoot.Forms;
        var folder = _tree.AddFolder(root);
        var sub = _tree.AddFolder(root, folder.Id);

        var result = new MoveService(_tree.Tree).Move<PersistedFolder>(folder.Id, sub.Id);

        Assert.Equal((ServiceStatus.Invalid, "targetId"), Tuple(result));
        Assert.Equal(new[] { root, folder.Id }, _tree.Repositories.Folders.Get(folder.Id).Path);
        Assert.Equal(new[] { root, folder.Id, sub.Id }, _tree.Repositories.Folders.Get(sub.Id).Path);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_stored_folder_outside_the_three_trees_is_not_found(bool emptyPath)
    {
        var id = Guid.NewGuid();
        _tree.Repositories.Folders.Save(new PersistedFolder { Id = id, Name = "Stray", Path = emptyPath ? Array.Empty<Guid>() : new[] { Guid.NewGuid(), id } });
        var service = CreateService();

        Assert.Equal(ServiceStatus.NotFound, service.Get(id).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Update(id, new UpdateFolderRequestModel { Name = "x" }).Status);
        Assert.Equal("Stray", _tree.Repositories.Folders.Get(id).Name);
    }

    [Fact]
    public void Delete_folder_with_an_unexpected_descendant_type_deletes_nothing()
    {
        var folder = _tree.AddFolder(FormConstantsRoot.Forms);
        var form = _tree.AddForm(folder.Id);
        var fake = new FakeTreeEntityRepository();
        fake.Add(folder);
        fake.Add(form);
        fake.Add(new StrangeEntity { Id = Guid.NewGuid(), Name = "Strange", Path = folder.Path.Append(Guid.NewGuid()).ToArray() });
        var service = new FolderApiService(
            fake,
            _tree.Repositories.Folders,
            _tree.Repositories.Forms,
            _tree.Repositories.Layouts,
            _tree.Repositories.DataValues,
            _tree.Repositories.Validations);

        var result = service.Delete(folder.Id);

        Assert.Equal((ServiceStatus.Conflict, "id"), Tuple(result));
        Assert.NotNull(_tree.Repositories.Folders.Get(folder.Id));
        Assert.NotNull(_tree.Repositories.Forms.Get(form.Id));
    }

    private sealed class StrangeEntity : Formulate.Core.Persistence.PersistedEntity
    {
    }
}
